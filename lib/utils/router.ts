import type { RouteParams, Route, AuthenticatedRequest } from '@/types/auth';

/**
 * Parse path parameters from a URL path
 */
export function parsePathParams(routePath: string, requestPath: string): RouteParams | null {
	const routeParts = routePath.split('/').filter(Boolean);
	const requestParts = requestPath.split('/').filter(Boolean);

	const params: RouteParams = {};
	let routeIndex = 0;
	let requestIndex = 0;

	while (routeIndex < routeParts.length && requestIndex < requestParts.length) {
		const routePart = routeParts[routeIndex];
		const requestPart = requestParts[requestIndex];

		// Check if this is a wildcard parameter
		if (routePart.startsWith(':') && routePart.endsWith('*')) {
			const paramName = routePart.slice(1, -1); // Remove ':' and '*'
			// Collect all remaining path parts
			const remainingParts = requestParts.slice(requestIndex);
			params[paramName] = remainingParts.join('/');
			break; // Wildcard consumes all remaining parts
		}
		// Check if this is a regular parameter
		else if (routePart.startsWith(':')) {
			const paramName = routePart.slice(1);
			params[paramName] = requestPart;
		}
		// Regular path parts must match exactly
		else if (routePart !== requestPart) {
			return null;
		}

		routeIndex++;
		requestIndex++;
	}

	// Check if all route parts were processed
	if (routeIndex < routeParts.length) {
		// There are unprocessed route parts that aren't wildcards
		const remainingRouteParts = routeParts.slice(routeIndex);
		const hasWildcard = remainingRouteParts.some((part) => part.startsWith(':') && part.endsWith('*'));
		if (!hasWildcard) {
			return null;
		}
	}

	// Check if all request parts were consumed (unless there was a wildcard)
	if (requestIndex < requestParts.length) {
		const hasWildcard = routeParts.some((part) => part.startsWith(':') && part.endsWith('*'));
		if (!hasWildcard) {
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
