import { redis } from '@/caching/redis';
import { getAccessTokenByHeader } from '@/middleware/auth';
import type { UserInRequest } from '@/types/auth';

const tokenCache = {
	formatKey(token: string) {
		try {
			return `token:${token}`;
		} catch (error) {
			throw new Error(`formatKey failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	async get(token: string) {
		try {
			const tokenCacheKey = tokenCache.formatKey(token);
			return await redis.get<UserInRequest>(tokenCacheKey);
		} catch (error) {
			throw new Error(`Get Token ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	async setByHeader(headers: Headers, user: UserInRequest) {
		try {
			const token = getAccessTokenByHeader(headers);
			return this.set(token, user);
		} catch (error) {
			throw new Error(`setByHeader failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	async set(token: string, user: UserInRequest) {
		try {
			const tokenCacheKey = tokenCache.formatKey(token);
			await redis.set(tokenCacheKey, user);
		} catch (error) {
			throw new Error(`Set Token ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	async clearByHeader(headers: Headers) {
		try {
			const token = getAccessTokenByHeader(headers);
			return this.clear(token);
		} catch (error) {
			throw new Error(`Clear Token ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	async clear(token: string) {
		try {
			const tokenCacheKey = tokenCache.formatKey(token);
			await redis.del(tokenCacheKey);
		} catch (error) {
			throw new Error(`Clear Token ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},
};

export default tokenCache;
