import type { AuthenticatedRequest, RouteParams } from '@/types/auth';

/**
 * Extract client IP address from request headers
 * Checks common proxy headers in priority order
 */
export function getClientIp(req: AuthenticatedRequest): string | null {
	// Priority order for IP detection
	const headers = [
		'cf-connecting-ip', // Cloudflare
		'x-real-ip', // Nginx proxy
		'x-forwarded-for', // Standard proxy header (may contain multiple IPs)
	];

	for (const header of headers) {
		const value = req.headers.get(header);
		if (value) {
			// x-forwarded-for may contain multiple IPs, take the first one (client IP)
			const ip = value.split(',')[0].trim();
			if (ip) return ip;
		}
	}

	// Fallback to socket IP for local/direct connections
	return req.socketIp || null;
}

/**
 * Middleware to extract client IP and attach to request
 */
export async function extractIp(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	req.clientIp = getClientIp(req);
	return null;
}
