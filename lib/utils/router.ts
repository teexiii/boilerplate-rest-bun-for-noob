import type { RouteParams, Route, AuthenticatedRequest } from '@/types/auth';

/**
 * Parse path parameters from a URL path
 */
export function parsePathParams(routePath: string, requestPath: string): RouteParams | null {
	const routeParts = routePath.split('/').filter(Boolean);
	const requestParts = requestPath.split('/').filter(Boolean);

	if (routeParts.length !== requestParts.length) {
		return null;
	}

	const params: RouteParams = {};

	for (let i = 0; i < routeParts.length; i++) {
		const routePart = routeParts[i];
		const requestPart = requestParts[i];

		// Check if this is a parameter
		if (routePart.startsWith(':')) {
			const paramName = routePart.slice(1);
			params[paramName] = requestPart;
		} else if (routePart !== requestPart) {
			// Regular path parts must match exactly
			return null;
		}
	}

	return params;
}

/**
 * Match a request to a route
 */
export function matchRoute(routes: Route[], req: AuthenticatedRequest): { route: Route; params: RouteParams } | null {
	const url = new URL(req.url);
	const method = req.method;
	const pathname = url.pathname;

	for (const route of routes) {
		if (route.method !== method) continue;

		const params = parsePathParams(route.path, pathname);
		if (params) {
			return { route, params };
		}
	}

	return null;
}
