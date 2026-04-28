import { openApiSpec } from '@/swagger/spec';
import path from 'path';
import mime from 'mime';

/**
 * Serve the OpenAPI spec as JSON
 */
export function serveSwaggerJson(): Response {
	return new Response(JSON.stringify(openApiSpec, null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

/**
 * Serve the Swagger UI HTML page
 */
export function serveSwaggerUi(baseUrl: string): Response {
	if (baseUrl?.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>API Documentation</title>
	<link rel="stylesheet" href="${baseUrl}/api/docs/swagger-ui.css" />
	<style>
		body { margin: 0; padding: 0; }
		.topbar { display: none; }
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="${baseUrl}/api/docs/swagger-ui-bundle.js"></script>
	<script src="${baseUrl}/api/docs/swagger-ui-standalone-preset.js"></script>
	<script>
		SwaggerUIBundle({
			url: "${baseUrl}/api/docs/swagger.json",
			dom_id: '#swagger-ui',
			presets: [
				SwaggerUIBundle.presets.apis,
				SwaggerUIStandalonePreset,
			],
			layout: 'StandaloneLayout',
			deepLinking: true,
		});
	</script>
</body>
</html>`;

	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

/**
 * Serve static files from swagger-ui-dist
 */
export async function serveSwaggerStatic(filename: string): Promise<Response> {
	try {
		const swaggerUiDist = path.dirname(require.resolve('swagger-ui-dist/package.json'));
		const filePath = path.join(swaggerUiDist, filename);
		const file = Bun.file(filePath);

		if (!(await file.exists())) {
			return new Response('Not found', { status: 404 });
		}

		const contentType = mime.getType(filename) || 'application/octet-stream';

		return new Response(file, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'public, max-age=86400',
			},
		});
	} catch {
		return new Response('Not found', { status: 404 });
	}
}
