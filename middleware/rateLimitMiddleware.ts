import { fail } from '@/lib/response';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/middleware/extractIp';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';

/**
 * Create a rate-limiting middleware that limits requests per IP address.
 *
 * Uses the existing Redis-backed sliding-window rate limiter (fail-open).
 * The key is scoped by a prefix + client IP to prevent brute-force attacks.
 *
 * @param limit   Max requests allowed in the window
 * @param windowSec   Window duration in seconds
 * @param prefix  Optional key prefix (defaults to 'api')
 */
export function rateLimitByIp(limit: number, windowSec: number, prefix: string = 'api') {
	return async function (req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
		const ip = getClientIp(req) || 'unknown';

		// Derive a stable path segment for the key (strip query string)
		const url = new URL(req.url);
		const path = url.pathname;

		const result = await rateLimit.consume({
			key: `rl:ip:${prefix}:${path}:${ip}`,
			limit,
			windowSec,
		});

		if (!result.allowed) {
			const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
			return new Response(
				JSON.stringify({
					status: false,
					message: 'Too many requests. Please try again later.',
				}),
				{
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(Math.max(1, retryAfter)),
					},
				}
			);
		}

		return null; // Continue to next middleware/handler
	};
}
