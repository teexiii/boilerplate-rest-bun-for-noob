import pkg from '@/package.json';
import appConfig from '@/config/appConfig';

export const openApiSpec = {
	openapi: '3.0.3',
	info: {
		title: pkg.name,
		version: pkg.version,
	},
	servers: [
		{
			url: appConfig.getBaseUrl(),
			description: 'Current server',
		},
	],
	tags: [
		{ name: 'Health', description: 'Health check endpoints' },
		{ name: 'Auth', description: 'Authentication endpoints' },
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
			},
		},
		schemas: {
			Pagination: {
				type: 'object',
				properties: {
					page: { type: 'integer', example: 1 },
					limit: { type: 'integer', example: 20 },
					total: { type: 'integer', example: 100 },
					totalPages: { type: 'integer', example: 5 },
				},
			},
		},
	},
	paths: {
		// =====================================================
		// HEALTH
		// =====================================================
		'/api/health-check': {
			get: {
				tags: ['Health'],
				summary: 'Health check',
				responses: {
					'200': {
						description: 'Server is running',
						content: {
							'application/json': {
								example: { status: true, data: 1 },
							},
						},
					},
				},
			},
		},
	},
};
