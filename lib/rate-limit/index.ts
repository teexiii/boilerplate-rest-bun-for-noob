import { redis } from '@/caching/redis';

interface RateLimitOptions {
	/** Redis key (e.g. `phone-login:phone:0901234567`) */
	key: string;
	/** Max requests allowed in the window */
	limit: number;
	/** Window duration in seconds */
	windowSec: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: Date;
}

/**
 * Redis-backed sliding-window rate limiter using INCR + EXPIRE NX.
 *
 * Pattern:
 *   INCR key        → atomic counter increment (creates key=1 if absent)
 *   EXPIRE key NX   → set TTL only if none exists (avoids resetting window)
 *
 * Fail-open: on Redis error, logs and allows the request.
 */
export const rateLimit = {
	async consume({ key, limit, windowSec }: RateLimitOptions): Promise<RateLimitResult> {
		try {
			const pipeline = redis.client.multi();
			pipeline.incr(key);
			// 'NX' flag: only set TTL if key has no expiry yet
			pipeline.expire(key, windowSec, 'NX');

			const results = await pipeline.exec();

			// pipeline.exec() returns [[err, val], [err, val]]
			if (!results || results[0][0]) {
				throw results?.[0][0] || new Error('Pipeline returned null');
			}

			const count = results[0][1] as number;
			const allowed = count <= limit;
			const remaining = Math.max(0, limit - count);
			const resetAt = new Date(Date.now() + windowSec * 1000);

			return { allowed, remaining, resetAt };
		} catch (error) {
			// Fail-open: allow request on Redis failure
			console.error('Rate limit Redis error (fail-open)', { key, error });
			return { allowed: true, remaining: limit, resetAt: new Date() };
		}
	},
};
