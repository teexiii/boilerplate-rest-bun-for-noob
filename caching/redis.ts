import { isLocal } from '@/config';
import appConfig from '@/config/appConfig';
import Redis from 'ioredis';

const redisClient = new Redis({
	port: appConfig.redis.port,
	host: appConfig.redis.host,
	...(appConfig.redis.username ? { username: appConfig.redis.username } : {}),
	...(appConfig.redis.password ? { password: appConfig.redis.password } : {}),
	...(appConfig.redis.db ? { db: appConfig.redis.db } : {}),
	// Connection pool configuration for better concurrency
	maxRetriesPerRequest: 3,
	enableOfflineQueue: false, // Fail fast instead of queuing when disconnected
	lazyConnect: false,
	retryStrategy: (times: number) => {
		if (times > 10) return null; // Max 10 retry attempts
		return Math.min(times * 100, 3000); // Exponential backoff, max 3s
	},
});

redisClient.on('error', (err) => {
	console.error('Redis error:', err);
});

// No need for explicit connect with ioredis
console.log('Redis client initialized');

// Cache TTL in seconds (default: min * sec)
// const DEFAULT_CACHE_TTL = 1 * 60;

export const redis = {
	client: redisClient,

	// Set value with TTL
	async set(key: string, value: any, ttl = appConfig.redis.cacheDuration): Promise<void> {
		try {
			await redisClient.set(key, JSON.stringify(value), 'EX', ttl);
		} catch (error) {
			throw new Error(`REDIS_SET_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Get value
	async get<T>(key: string): Promise<T | null> {
		try {
			if (isLocal) return null;

			const data = await redisClient.get(key);
			if (!data) return null;
			return JSON.parse(data) as T;
		} catch (error) {
			throw new Error(`REDIS_GET_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Delete value
	async del(key: string): Promise<void> {
		try {
			await redisClient.del(key);
		} catch (error) {
			throw new Error(`REDIS_DEL_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Delete multiple keys by pattern using SCAN (non-blocking)
	async delByPattern(pattern: string): Promise<void> {
		try {
			const keysToDelete: string[] = [];
			let cursor = '0';

			// Use SCAN instead of KEYS (non-blocking, cursor-based iteration)
			do {
				const result = await redisClient.scan(
					cursor,
					'MATCH',
					pattern,
					'COUNT',
					100 // Scan 100 keys per iteration
				);
				cursor = result[0]; // Next cursor position
				const keys = result[1]; // Keys found in this iteration
				keysToDelete.push(...keys);
			} while (cursor !== '0'); // cursor === '0' means scan complete

			// Delete keys in batches to avoid blocking on large deletes
			if (keysToDelete.length > 0) {
				const BATCH_SIZE = 100;
				for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
					const batch = keysToDelete.slice(i, i + BATCH_SIZE);
					await redisClient.del(...batch);
				}
			}
		} catch (error) {
			throw new Error(`REDIS_DEL_BY_PATTERN_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Set value only if it doesn't exist (atomic operation for replay attack prevention)
	async setNX(key: string, value: any, ttl = appConfig.redis.cacheDuration): Promise<boolean> {
		try {
			const result = await redisClient.set(key, JSON.stringify(value), 'EX', ttl, 'NX');
			// Redis returns 'OK' if set succeeded, null if key already exists
			return result === 'OK';
		} catch (error) {
			throw new Error(`REDIS_SETNX_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},
};
