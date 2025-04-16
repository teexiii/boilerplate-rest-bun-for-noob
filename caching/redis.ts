import AppConfig from '@/config/AppConfig';
import Redis from 'ioredis';

const redisClient = new Redis({
	port: AppConfig.redis.port,
	host: AppConfig.redis.host,
	...(AppConfig.redis.username ? { username: AppConfig.redis.username } : {}),
	...(AppConfig.redis.password ? { password: AppConfig.redis.password } : {}),
	...(AppConfig.redis.db ? { db: AppConfig.redis.db } : {}),
});

redisClient.on('error', (err) => {
	console.error('Redis error:', err);
});

// No need for explicit connect with ioredis
console.log('Redis client initialized');

// Cache TTL in seconds (default: min * sec)
const DEFAULT_CACHE_TTL = 1 * 60;

export const redis = {
	client: redisClient,

	// Set value with TTL
	async set(key: string, value: any, ttl = DEFAULT_CACHE_TTL): Promise<void> {
		try {
			await redisClient.set(key, JSON.stringify(value), 'EX', ttl);
		} catch (error) {
			throw new Error(`REDIS_SET_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	// Get value
	async get<T>(key: string): Promise<T | null> {
		try {
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

	// Delete multiple keys by pattern
	async delByPattern(pattern: string): Promise<void> {
		try {
			const keys = await redisClient.keys(pattern);
			if (keys.length > 0) {
				await redisClient.del(keys);
			}
		} catch (error) {
			throw new Error(`REDIS_DEL_BY_PATTERN_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},
};
