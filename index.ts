import { fail500, fail } from '@/lib/response';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import type { AuthenticatedRequest } from '@/types/auth';
import { logger } from '@/lib/logger';
import { requestLogger } from '@/middleware/logger';
import appConfig from '@/config/appConfig';
import { initDb } from '@/lib/server/db';

(async () => {
	// Initialize database connection before starting server
	await initDb();

	// Setup Bun server
	const server = Bun.serve({
		port: appConfig.port,
		async fetch(req: Request) {
			// const url = new URL(req.url);
			const method = req.method;

			// Handle CORS preflight requests
			if (method === 'OPTIONS') {
				return new Response(null, {
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type, Authorization',
						'Access-Control-Max-Age': '86400', // 24 hours
					},
				});
			}

			// Match route
			const match = matchRoute(routes, req as AuthenticatedRequest);

			if (match) {
				const { route, params } = match;

				try {
					// Cast request to AuthenticatedRequest for middleware
					const authReq = req as AuthenticatedRequest;

					// Add logger middleware first
					await requestLogger(authReq, params);

					// Run other middleware
					if (route.middleware && route.middleware.length > 0) {
						for (const middleware of route.middleware) {
							const result = await middleware(authReq, params);
							if (result) {
								authReq.logEnd?.(result.status);
								return result;
							}
						}
					}

					// Run route handler
					const next = await route.handler(authReq, params);
					const response = await next();
					authReq.logEnd?.(response.status);
					return response;
				} catch (error) {
					logger.error('Request error:', error);
					const response = fail500('Internal server error');
					(req as any).logEnd?.(response.status, error);
					return response;
				}
			}

			// No route matched
			const response = fail('Not found', 404);
			return response;
		},
	});

	logger.info(`Server running at ${server.url}`);
})();
