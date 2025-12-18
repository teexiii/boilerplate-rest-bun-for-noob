import { fail404, success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import type { AuthenticatedRequest, Route, RouteParams } from '@/types/auth';

export const defaultRoutes: Route[] = [
	{
		path: '/',
		method: 'GET',
		handler: async (req: AuthenticatedRequest, params: RouteParams) =>
			errorHandler(async () => {
				return new Response('', {
					status: 200,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET',
					},
				});
			}),
	},
	{
		path: '/api/health-check',
		method: 'GET',
		handler: async (req: AuthenticatedRequest, params: RouteParams) =>
			errorHandler(async () => {
				return success({ data: 1 });
			}),
	},
	{
		path: '/hz',
		method: 'GET',
		handler: async (req: AuthenticatedRequest, params: RouteParams) =>
			errorHandler(async () => {
				return success({ data: 1 });
			}),
	},
];
