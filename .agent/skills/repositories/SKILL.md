---
name: repositories
description: 'Data access layer with raw SQL reads and Prisma writes'
slug: repositories
---

# Repository Layer Guide

This guide covers detailed patterns for working with the repository layer (`repositories/`).

## Core Principle: Raw SQL for Reads, Prisma for Writes

### Raw SQL for All `find*` Methods

All read operations use `db.$queryRaw<any[]>` for performance and control:

```typescript
async findById(id: string) {
    const result = await db.$queryRaw<any[]>`
        SELECT
            u.id,
            u.email,
            u.name,
            u.email_verified as "emailVerified",
            u.role_id as "roleId",
            u.created_at as "createdAt",
            r.id as "role.id",
            r.name as "role.name"
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        WHERE u.id = ${id}::uuid
    `;

    if (result.length === 0) return null;
    return mapRowToUser(result[0]);
}
```

### Prisma ORM for Mutations

All create/update/delete use Prisma's type-safe methods:

```typescript
import { toBase62 } from 'diginext-utils/string';

/**
 * Create a new home with owner (Prisma ORM)
 */
async create(userId: string, data: HomeCreateInput): Promise<HomeWithMembers> {
    // Generate unique invite code
    const code = v4();

    let home = await queueWrite(() =>
        db.home.create({
            data: {
                code,
                name: data.name,
                image: data.image,
                timezone: data.timezone || 'UTC',
                members: {
                    create: {
                        userId,
                        role: 'OWNER',
                        acceptedAt: new Date(),
                    },
                },
            },
        })
    );

    home = await queueWrite(() =>
        db.home.update({
            where: { id: home.id },
            data: { code: toBase62(home.idx) },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, image: true },
                        },
                    },
                },
            },
        })
    );

    await homeCache.clearByUserId(userId);
    return home as HomeWithMembers;
},
```

## SQL Naming Conventions

Always use aliases to convert snake_case to camelCase:

```sql
-- Column aliases
email_verified as "emailVerified"
created_at as "createdAt"
role_id as "roleId"

-- Nested aliases for relations
r.id as "role.id"
r.name as "role.name"
m.user_id as "member.userId"
```

## Relation Loading with JOINs

### One-to-One Relations

```typescript
const result = await db.$queryRaw<any[]>`
    SELECT
        u.id, u.email,
        r.id as "role.id",
        r.name as "role.name"
    FROM users u
    INNER JOIN roles r ON u.role_id = r.id
    WHERE u.id = ${id}::uuid
`;

const mapRowToUser = (row: any): UserWithRole => ({
	id: row.id,
	email: row.email,
	role: {
		id: row['role.id'],
		name: row['role.name'],
	},
});
```

### One-to-Many Relations

```typescript
const mapRowsToHomes = (rows: any[]): HomeWithMembers[] => {
	const homesMap = new Map<string, HomeWithMembers>();

	for (const row of rows) {
		if (!homesMap.has(row.id)) {
			homesMap.set(row.id, {
				id: row.id,
				name: row.name,
				members: [],
			});
		}

		const home = homesMap.get(row.id)!;
		if (row['member.id']) {
			home.members.push({
				id: row['member.id'],
				role: row['member.role'],
				userId: row['member.userId'],
			});
		}
	}

	return Array.from(homesMap.values());
};
```

## nestFlatObject Helper

Converts dot-notation keys to nested objects:

```typescript
import { nestFlatObject } from '@/lib/utils/helper';

// Input: { id: '1', 'role.id': '2', 'role.name': 'admin' }
// Output: { id: '1', role: { id: '2', name: 'admin' } }

const user = nestFlatObject<UserWithRole>(row);
```

## Queue Write Operations

All mutations must use `queueWrite()` for rate-limiting (20 concurrent writes):

```typescript
import { queueWrite } from '@/lib/utils/helper';

async create(data: ActivityCreateInput): Promise<ActivityWithBaby> {
    const activity = await queueWrite(() =>
        db.activity.create({
            data: { ... },
            include: { baby: true, media: true },
        })
    );
    return activity;
}
```

## Cache Integration Pattern

### Read with Cache-Aside

```typescript
async findById(id: string): Promise<UserWithRole | null> {
    // 1. Try cache first
    const cached = await userCache.getById(id);
    if (cached) return cached;

    // 2. Fallback to database
    const result = await db.$queryRaw<any[]>`...`;
    if (result.length === 0) return null;

    const user = mapRowToUser(result[0]);

    // 3. Store in cache
    await userCache.setById(id, user);
    return user;
}
```

### Cache Invalidation After Mutations

```typescript
async create(data: UserCreateInput): Promise<IUser> {
    const user = await queueWrite(() => db.user.create({ data }));

    // Invalidate all relevant caches
    await userCache.clearLists();
    return user;
}

async update(id: string, data: UserUpdateInput): Promise<IUser> {
    const user = await queueWrite(() => db.user.update({ where: { id }, data }));

    // Invalidate by ID and email, plus all lists
    await Promise.all([
        userCache.invalidate(id, user.email),
        homeCache.clearAll(), // Cascade: user info affects home display
    ]);
    return user;
}
```

## Complex SQL Aggregations

Use PostgreSQL's FILTER clause for analytics:

```typescript
async getDailyStats(babyId: string, date: Date) {
    const [stats] = await db.$queryRaw<any[]>`
        SELECT
            COUNT(*) FILTER (WHERE type = 'SLEEP') AS "sleepCount",
            COALESCE(SUM(duration) FILTER (WHERE type = 'SLEEP'), 0) AS "sleepMinutes",
            COUNT(*) FILTER (WHERE type = 'FEEDING') AS "feedingCount",
            COUNT(*) FILTER (WHERE type = 'FEEDING' AND feeding_type = 'BREAST') AS "breastCount",
            MAX(temperature) FILTER (WHERE type = 'TEMPERATURE') AS "temperatureMax",
            COUNT(*) AS "totalActivities"
        FROM activities
        WHERE baby_id = ${babyId}::uuid
            AND start_time >= ${dayStart}
            AND start_time < ${dayEnd}
    `;
    return stats;
}
```

## Separate Relation Fetching

For complex relations, fetch separately then combine:

```typescript
const fetchSocials = async (userId: string) => {
    return await db.$queryRaw<any[]>`
        SELECT id, provider, email, profile_data as "profileData"
        FROM socials
        WHERE user_id = ${userId}::uuid
    `;
};

async findById(id: string) {
    const [userRows, socials] = await Promise.all([
        db.$queryRaw<any[]>`SELECT ... FROM users WHERE id = ${id}::uuid`,
        fetchSocials(id),
    ]);

    return { ...mapRowToUser(userRows[0]), socials };
}
```

## Key Patterns Summary

| Pattern                            | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| `db.$queryRaw<any[]>`              | Type-safe raw SQL for reads                |
| `db.entity.create/update/delete()` | Prisma ORM for mutations                   |
| `queueWrite()`                     | Rate-limit writes (20 concurrent)          |
| `as "camelCase"`                   | Snake to camel case conversion             |
| `as "relation.field"`              | Nested relation mapping                    |
| `nestFlatObject()`                 | Convert flat rows to nested objects        |
| Cache-aside pattern                | Check cache → DB fallback → cache populate |
| `cache.invalidate()`               | Clear after mutations                      |
