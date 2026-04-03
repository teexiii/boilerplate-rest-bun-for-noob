---
name: caching
description: 'Redis caching patterns and cache-aside strategies'
slug: caching
---

# Caching Layer Guide

This guide covers Redis caching patterns in the `caching/` directory.

## Cache Module Structure

```
caching/
├── redis.ts          # Core Redis client and utilities
├── userCache.ts      # User-specific cache operations
├── babyCache.ts      # Baby-specific cache operations
├── homeCache.ts      # Home-specific cache operations
└── activityCache.ts  # Activity-specific cache operations
```

## Key Prefix Patterns

Use hierarchical namespacing: `entity:type:identifier`

```typescript
const KEY_PREFIX = {
	USER: 'user',
	USER_BY_ID: 'user:id',
	USER_BY_EMAIL: 'user:email',
	USER_LIST: 'user:list',
	USER_SEARCH: 'user:search',
	USER_BY_ROLE: 'user:role',
	USER_EXISTS: 'user:exists',
};

// Example keys:
// user:id:abc-123-uuid
// user:email:john@example.com
// user:list:page:1:limit:20
// activity:calendar:home-uuid:2024-01-01:2024-01-31
```

## TTL Strategies

Define TTLs per data type based on update frequency:

```typescript
const TTL = {
	// Single entity - moderate duration
	USER_DETAIL: 5 * 60, // 5 minutes

	// Lists change more frequently
	USER_LIST: 2 * 60, // 2 minutes

	// Existence checks - short
	USER_EXISTS: 1 * 60, // 1 minute

	// Activities change very frequently
	ACTIVITY_LIST: 1 * 60, // 1 minute
	ACTIVITY_CALENDAR: 2 * 60,
};

// Global fallback from config
cacheDuration: env('REDIS_CACHE_DURATION', true, 60); // 60 seconds
```

## Redis Client Methods

### Core Operations

```typescript
import { redis } from '@/caching/redis';

// Set with TTL (seconds)
await redis.set('user:id:123', userData, 300);

// Get with type safety
const user = await redis.get<UserWithRole>('user:id:123');

// Delete single key
await redis.del('user:id:123');

// Delete by pattern (non-blocking SCAN)
await redis.delByPattern('user:list:*');

// Set only if not exists (atomic)
const wasSet = await redis.setNX('lock:operation', value, 30);
```

### Pattern-Based Deletion

Uses SCAN (not KEYS) to avoid blocking:

```typescript
async delByPattern(pattern: string): Promise<void> {
    const keysToDelete: string[] = [];
    let cursor = '0';

    // Non-blocking cursor iteration
    do {
        const result = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keysToDelete.push(...result[1]);
    } while (cursor !== '0');

    // Batch deletion
    if (keysToDelete.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
            const batch = keysToDelete.slice(i, i + BATCH_SIZE);
            await redisClient.del(...batch);
        }
    }
}
```

## Entity Cache Service Pattern

```typescript
// caching/userCache.ts
export const userCache = {
	formatKey(prefix: string, id: string): string {
		return `${prefix}:${id}`;
	},

	// Get by ID
	async getById(id: string): Promise<UserWithRelations | null> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_ID, id);
			return await redis.get<UserWithRelations>(cacheKey);
		} catch (error) {
			console.error('[UserCache] Get by ID failed:', error);
			return null; // Don't throw - graceful degradation
		}
	},

	// Set by ID
	async setById(id: string, data: UserWithRelations, ttl = TTL.USER_DETAIL): Promise<void> {
		try {
			const cacheKey = this.formatKey(KEY_PREFIX.USER_BY_ID, id);
			await redis.set(cacheKey, data, ttl);
		} catch (error) {
			console.error('[UserCache] Set by ID failed:', error);
		}
	},

	// Clear single entity
	async clear(id: string, email?: string): Promise<void> {
		try {
			await Promise.all([
				redis.del(this.formatKey(KEY_PREFIX.USER_BY_ID, id)),
				email ? redis.del(this.formatKey(KEY_PREFIX.USER_BY_EMAIL, email)) : Promise.resolve(),
			]);
		} catch (error) {
			console.error('[UserCache] Clear failed:', error);
		}
	},

	// Clear all lists (after mutations)
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

	// Full invalidation
	async invalidate(id: string, email?: string): Promise<void> {
		try {
			await Promise.all([this.clear(id, email), this.clearLists()]);
		} catch (error) {
			console.error('[UserCache] Invalidate failed:', error);
		}
	},
};
```

## Cache-Aside Pattern

### Read Operations

```typescript
async findById(id: string): Promise<UserWithRole | null> {
    // 1. Try cache first
    const cached = await userCache.getById(id);
    if (cached) return cached;

    // 2. Fallback to database
    const result = await db.$queryRaw<any[]>`...`;
    if (result.length === 0) return null;

    const user = mapRowToUser(result[0]);

    // 3. Store in cache (background, non-blocking)
    userCache.setById(id, user).catch(console.error);

    return user;
}
```

### GetOrSet Helper

```typescript
async getOrSet<T>(
    key: string,
    prefix: string,
    computeFn: () => Promise<T>,
    ttl = TTL.USER_DETAIL
): Promise<T> {
    const cacheKey = `${prefix}:${key}`;
    const cached = await redis.get<T>(cacheKey);
    if (cached !== null) return cached;

    const value = await computeFn();

    // Background cache set
    redis.set(cacheKey, value, ttl).catch(console.error);

    return value;
}
```

## Invalidation Patterns

### After Create

```typescript
async create(data: UserCreateInput): Promise<IUser> {
    const user = await queueWrite(() => db.user.create({ data }));

    // Clear list caches (new item affects lists)
    await userCache.clearLists();

    return user;
}
```

### After Update

```typescript
async update(id: string, data: UserUpdateInput): Promise<IUser> {
    const user = await queueWrite(() =>
        db.user.update({ where: { id }, data })
    );

    // Clear specific + lists
    await Promise.all([
        userCache.invalidate(id, user.email),
        // Cascade: user info affects home display
        homeCache.clearAll(),
    ]);

    return user;
}
```

### After Delete

```typescript
async delete(id: string): Promise<void> {
    const user = await db.user.findUnique({ where: { id } });

    await queueWrite(() => db.user.delete({ where: { id } }));

    // Full invalidation
    await userCache.invalidate(id, user?.email);
}
```

### Cascading Invalidation

```typescript
async create(data: ActivityCreateInput, homeId: string) {
    const activity = await queueWrite(() => db.activity.create({ data }));

    await Promise.all([
        activityCache.invalidate(activity.id, data.babyId, homeId),
        // Baby shows recent activities
        babyCache.clear(data.babyId),
    ]);

    return activity;
}
```

## Error Handling

All cache operations use non-throwing error handling:

```typescript
async clear(id: string): Promise<void> {
    try {
        await redis.del(this.formatKey(KEY_PREFIX.BABY_BY_ID, id));
    } catch (error) {
        // Log but don't throw - cache failures shouldn't break the app
        console.error('[BabyCache] Clear failed:', error);
    }
}
```

## Local Development

Cache is disabled in local development:

```typescript
async get<T>(key: string): Promise<T | null> {
    try {
        if (isLocal) return null;  // Skip cache in dev

        const data = await redisClient.get(key);
        return data ? JSON.parse(data) as T : null;
    } catch (error) {
        // ...
    }
}
```

## Redis Client Configuration

```typescript
const redisClient = new Redis({
	port: appConfig.redis.port,
	host: appConfig.redis.host,
	username: appConfig.redis.username,
	password: appConfig.redis.password,
	db: appConfig.redis.db,

	maxRetriesPerRequest: 3,
	enableOfflineQueue: false, // Fail fast
	lazyConnect: false,

	retryStrategy: (times: number) => {
		if (times > 10) return null; // Max 10 retries
		return Math.min(times * 100, 3000); // Exponential backoff
	},
});
```

## Key Design Principles

1. **Hierarchical namespacing** - `entity:type:identifier`
2. **Dual indexing** - Cache by both ID and unique fields (email)
3. **Query keys** - Include normalized query params in list cache keys
4. **Date-based keys** - Calendar caches include date ranges
5. **Graceful degradation** - Cache failures don't break the app
6. **Background writes** - Don't block requests for cache updates
7. **Batch operations** - Delete keys in batches of 100
