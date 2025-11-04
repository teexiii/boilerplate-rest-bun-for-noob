import { redis } from '@/caching/redis';
import type { UserWithRole } from '@/types/user';
import type { Social } from '@prisma/client';

type UserWithRelations = UserWithRole & { socials?: Social[] };

/**
 * Cache TTL constants (in seconds)
 */
const TTL = {
	/** Single user details - 5 minutes */
	USER_DETAIL: 5 * 60,
	/** User list/search results - 2 minutes */
	USER_LIST: 2 * 60,
	/** User existence check - 1 minute */
	USER_EXISTS: 1 * 60,
} as const;

/**
 * Cache key prefixes for different user-related data
 */
const KEY_PREFIX = {
	USER: 'user',
	USER_BY_ID: 'user:id',
	USER_BY_EMAIL: 'user:email',
	USER_LIST: 'user:list',
	USER_SEARCH: 'user:search',
	USER_BY_ROLE: 'user:role',
	USER_EXISTS: 'user:exists',
} as const;

/**
 * User cache service for managing user-related Redis cache operations
 */
export const userCache = {
	/**
	 * Format cache key with namespace
	 */
	formatKey(prefix: string, key: string): string {
		return `${prefix}:${key}`;
	},

	/**
	 * Get user by ID from cache
	 */
	async getById(id: string): Promise<UserWithRelations | null> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_ID, id);
			return await redis.get<UserWithRelations>(cacheKey);
		} catch (error) {
			console.error('[UserCache] Get by ID failed:', error);
			return null; // Return null on cache miss or error
		}
	},

	/**
	 * Set user by ID in cache
	 */
	async setById(id: string, data: UserWithRelations, ttl = TTL.USER_DETAIL): Promise<void> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_ID, id);
			await redis.set(cacheKey, data, ttl);
		} catch (error) {
			console.error('[UserCache] Set by ID failed:', error);
			// Don't throw - cache failures shouldn't break the app
		}
	},

	/**
	 * Get user by email from cache
	 */
	async getByEmail(email: string): Promise<UserWithRelations | null> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_EMAIL, email.toLowerCase());
			return await redis.get<UserWithRelations>(cacheKey);
		} catch (error) {
			console.error('[UserCache] Get by email failed:', error);
			return null;
		}
	},

	/**
	 * Set user by email in cache
	 */
	async setByEmail(email: string, data: UserWithRelations, ttl = TTL.USER_DETAIL): Promise<void> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_EMAIL, email.toLowerCase());
			await redis.set(cacheKey, data, ttl);
		} catch (error) {
			console.error('[UserCache] Set by email failed:', error);
		}
	},

	/**
	 * Get user list from cache
	 */
	async getList(queryKey: string): Promise<UserWithRelations[] | null> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_LIST, queryKey);
			return await redis.get<UserWithRelations[]>(cacheKey);
		} catch (error) {
			console.error('[UserCache] Get list failed:', error);
			return null;
		}
	},

	/**
	 * Set user list in cache
	 */
	async setList(queryKey: string, data: UserWithRelations[], ttl = TTL.USER_LIST): Promise<void> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_LIST, queryKey);
			await redis.set(cacheKey, data, ttl);
		} catch (error) {
			console.error('[UserCache] Set list failed:', error);
		}
	},

	/**
	 * Get users by role from cache
	 */
	async getByRole(roleId: string, options?: { limit?: number; offset?: number }): Promise<UserWithRelations[] | null> {
		try {
			const cacheKey = this.formatKey(
				KEY_PREFIX.USER_BY_ROLE,
				`${roleId}:${options?.limit || 'all'}:${options?.offset || 0}`
			);
			return await redis.get<UserWithRelations[]>(cacheKey);
		} catch (error) {
			console.error('[UserCache] Get by role failed:', error);
			return null;
		}
	},

	/**
	 * Set users by role in cache
	 */
	async setByRole(
		roleId: string,
		data: UserWithRelations[],
		options?: { limit?: number; offset?: number }
	): Promise<void> {
		try {
			const cacheKey = this.formatKey(
				KEY_PREFIX.USER_BY_ROLE,
				`${roleId}:${options?.limit || 'all'}:${options?.offset || 0}`
			);
			await redis.set(cacheKey, data, TTL.USER_LIST);
		} catch (error) {
			console.error('[UserCache] Set by role failed:', error);
		}
	},

	/**
	 * Check if user exists in cache
	 */
	async exists(id: string): Promise<boolean> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_ID, id);
			const data = await redis.get(cacheKey);
			return data !== null;
		} catch (error) {
			console.error('[UserCache] Exists check failed:', error);
			return false;
		}
	},

	/**
	 * Get from cache or compute and store
	 */
	async getOrSet<T>(key: string, prefix: string, computeFn: () => Promise<T>, ttl = TTL.USER_DETAIL): Promise<T> {
		try {
			// Try to get from cache
			const cacheKey = this.formatKey(prefix, key);
			const cached = await redis.get<T>(cacheKey);

			if (cached !== null) {
				return cached;
			}

			// Not in cache, compute value
			const value = await computeFn();

			// Store in cache (don't await to avoid blocking)
			redis.set(cacheKey, value, ttl).catch((err) => console.error('[UserCache] Background cache set failed:', err));

			return value;
		} catch (error) {
			console.error('[UserCache] GetOrSet failed:', error);
			// On error, just compute the value
			return await computeFn();
		}
	},

	/**
	 * Clear specific user from cache (both by ID and email)
	 */
	async clear(id: string, email?: string): Promise<void> {
		try {
			const promises: Promise<void>[] = [redis.del(this.formatKey(KEY_PREFIX.USER_BY_ID, id))];

			if (email) {
				promises.push(redis.del(this.formatKey(KEY_PREFIX.USER_BY_EMAIL, email.toLowerCase())));
			}

			await Promise.all(promises);
		} catch (error) {
			console.error('[UserCache] Clear failed:', error);
		}
	},

	/**
	 * Clear user list caches (after user update/delete)
	 */
	async clearLists(): Promise<void> {
		try {
			await Promise.all([
				redis.delByPattern(`${KEY_PREFIX.USER_LIST}:*`),
				redis.delByPattern(`${KEY_PREFIX.USER_SEARCH}:*`),
				redis.delByPattern(`${KEY_PREFIX.USER_BY_ROLE}:*`),
			]);
		} catch (error) {
			console.error('[UserCache] Clear lists failed:', error);
		}
	},

	/**
	 * Clear all user-related caches
	 */
	async clearAll(): Promise<void> {
		try {
			await redis.delByPattern(`${KEY_PREFIX.USER}:*`);
			console.log('[UserCache] All user caches cleared');
		} catch (error) {
			console.error('[UserCache] Clear all failed:', error);
			throw new Error(`Failed to clear user caches: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	/**
	 * Invalidate user cache after update (clear the user and all lists)
	 */
	async invalidate(id: string, email?: string): Promise<void> {
		try {
			await Promise.all([this.clear(id, email), this.clearLists()]);
		} catch (error) {
			console.error('[UserCache] Invalidate failed:', error);
		}
	},
};

export default userCache;
