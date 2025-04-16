import { logger } from '@/lib/logger';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';

export const requestLogger = async (req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> => {
	const requestId = crypto.randomUUID();
	const start = Date.now();

	// Add logger to request
	req.log = logger.child({ requestId });

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
