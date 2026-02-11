import { logger } from '@/lib/logger';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';

// Fast request ID counter
let requestCounter = 0;

// Fast non-cryptographic request ID generation
function generateRequestId(): string {
	return `${Date.now()}-${(requestCounter = (requestCounter + 1) % 100000)}`;
}

export const requestLogger = async (req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> => {
	// Use fast timestamp-based ID instead of crypto.randomUUID
	if (req.url.includes('/hz')) {
		return null;
	}

	const requestId = generateRequestId();
	const start = Date.now();

	// Use inline context instead of child logger to avoid object allocation
	const logContext = { requestId };

	// Create lightweight logging wrapper
	req.log = {
		info: (data: any) => logger.info({ ...data, ...logContext }),
		error: (data: any) => logger.error({ ...data, ...logContext }),
		warn: (data: any) => logger.warn({ ...data, ...logContext }),
		debug: (data: any) => logger.debug({ ...data, ...logContext }),
	};

	// Log request
	req.log.info({
		type: 'request',
		method: req.method,
		url: req.url,
		userId: req.user?.id,
		params,
	});

	// Add end logging to request
	req.logEnd = (statusCode: number, error?: any) => {
		const duration = Date.now() - start;
		if (error) {
			req.log?.error({
				type: 'response',
				statusCode,
				duration,
				error: {
					message: error.message,
					stack: error.stack,
					cause: error.cause,
				},
			});
		} else {
			req.log?.info({
				type: 'response',
				statusCode,
				duration,
			});
		}
	};

	return null;
};
