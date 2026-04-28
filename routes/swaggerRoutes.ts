import appConfig from '@/config/appConfig';
import { serveSwaggerJson, serveSwaggerStatic, serveSwaggerUi } from '@/swagger';
import { errorHandler } from '@/middleware/error';
import type { AuthenticatedRequest, Route, RouteParams } from '@/types/auth';

export const swaggerRoutes: Route[] = [
	// Swagger UI
	{
		path: '/api/docs',
		method: 'GET',
		handler: async (req: AuthenticatedRequest, params: RouteParams) =>
			errorHandler(async () => {
				const baseUrl = appConfig.getBaseUrl();
				return serveSwaggerUi(baseUrl);
			}),
	},
	// OpenAPI spec JSON
	{
		path: '/api/docs/swagger.json',
		method: 'GET',
		handler: async (req: AuthenticatedRequest, params: RouteParams) =>
			errorHandler(async () => {
				return serveSwaggerJson();
			}),
	},
	// Static assets (CSS, JS)
	{
		path: '/api/docs/:filename',
		method: 'GET',
		handler: async (req: AuthenticatedRequest, params: RouteParams) =>
			errorHandler(async () => {
				return serveSwaggerStatic(params.filename);
			}),
	},
];
