---
name: types
description: 'TypeScript type definitions, response types, and mappers'
slug: types
---

# Types Layer Guide

This guide covers TypeScript type definitions in the `types/` directory.

## File Structure

Each entity has a dedicated type file: `types/[entity].ts`

Contents typically include:

1. Extended Prisma types with relations
2. Input types for create/update operations
3. Response types for API output
4. Mapper functions

## Extended Prisma Types

Combine Prisma models with nested relations using intersection types:

```typescript
import type { User, Role, Social, Activity, Baby } from '@prisma/client';

// Basic extension with relation
export type UserWithRole = Omit<User, 'password'> & {
	role: Role;
	password?: string | null;
};

// Extension with optional relation
export type UserSocials = UserWithRole & {
	socials?: Social[];
};

// Pick specific fields from relations
export type ActivityWithBaby = Activity & {
	baby: Pick<Baby, 'id' | 'name' | 'color'>;
	media: ActivityMediaItem[];
};

// Nested relation types
export type HomeMemberWithUser = HomeMember & {
	user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
};

export type HomeWithMembers = Home & {
	members: HomeMemberWithUser[];
};
```

## Input Types

Define request data structures for operations:

### Create Input

```typescript
export interface ActivityCreateInput {
	type: ActivityType;
	startTime: Date;
	endTime?: Date;
	duration?: number;
	notes?: string;
	// Type-specific fields
	sleepQuality?: SleepQuality;
	feedingType?: FeedingType;
	amount?: number;
	// Required relation
	babyId: string;
}
```

### Update Input (All fields optional)

```typescript
export interface ActivityUpdateInput {
	type?: ActivityType;
	startTime?: Date;
	endTime?: Date;
	duration?: number;
	notes?: string;
	sleepQuality?: SleepQuality;
	feedingType?: FeedingType;
}
```

### Query Parameters

```typescript
export interface ActivityQueryParams {
	babyId?: string;
	homeId?: string;
	type?: ActivityType;
	startDate?: Date;
	endDate?: Date;
	limit?: number;
	offset?: number;
}
```

## Response Types

Define clean API response contracts:

```typescript
export interface UserResponse {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	emailVerified: boolean;
	role: {
		id: string;
		name: string;
	};
	socials?: {
		provider: string;
		email: string | null;
	}[];
	createdAt: Date;
}

export interface ActivityResponse {
	id: string;
	type: ActivityType;
	startTime: Date;
	endTime: Date | null;
	duration: number | null;
	notes: string | null;
	// Flattened relation data
	babyId: string;
	babyName: string;
	babyColor: string | null;
	// Nested array
	media: ActivityMediaResponse[];
	createdAt: Date;
}
```

## Mapper Functions

Transform internal/database types to API response types:

### Basic Mapper

```typescript
export const toUserResponse = (user: UserSocials): UserResponse => ({
	id: user.id,
	email: user.email,
	name: user.name || user.email,
	image: user.image,
	emailVerified: !!user.emailVerified,
	role: {
		id: user.role.id,
		name: user.role.name,
	},
	socials: user.socials?.map((sl) => ({
		provider: sl.provider,
		email: sl.email,
	})),
	createdAt: user.createdAt,
});
```

### Mapper with Nested Mapping

```typescript
export const toActivityResponse = (activity: ActivityWithBaby): ActivityResponse => ({
	id: activity.id,
	type: activity.type,
	startTime: activity.startTime,
	endTime: activity.endTime,
	duration: activity.duration,
	notes: activity.notes,
	// Flatten nested relation
	babyId: activity.babyId,
	babyName: activity.baby.name,
	babyColor: activity.baby.color,
	// Map nested array
	media: activity.media.map(toActivityMediaResponse),
	createdAt: activity.createdAt,
});

export const toActivityMediaResponse = (media: ActivityMediaItem): ActivityMediaResponse => ({
	id: media.id,
	url: media.url,
	urlWebp: media.urlWebp,
	type: media.type,
	caption: media.caption,
	sortOrder: media.sortOrder,
	fileSize: media.fileSize,
});
```

### Mapper with Date Formatting

```typescript
export const toHomeResponse = (home: HomeWithMembers): HomeResponse => ({
	id: home.id,
	code: home.code,
	name: home.name,
	image: home.image,
	timezone: home.timezone,
	members: home.members?.map(toHomeMemberResponse),
	// Convert dates to ISO strings
	createdAt: typeof home.createdAt === 'string' ? home.createdAt : home.createdAt.toISOString(),
	updatedAt: typeof home.updatedAt === 'string' ? home.updatedAt : home.updatedAt.toISOString(),
});
```

## Auth-Related Types

```typescript
export interface TokenPayload {
	userId: string;
	roleId: string;
	roleName: string;
	iat?: number;
	exp?: number;
}

export interface UserInRequest extends UserWithRole {
	isAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
	user?: UserInRequest;
	log?: RequestLogger;
	logEnd?: (statusCode: number, error?: any) => void;
	clientIp?: string | null;
}

export interface RouteParams {
	[key: string]: string;
}

export interface Route {
	path: string;
	method: string;
	handler: RouteHandler;
	middleware?: Array<(req: AuthenticatedRequest, params: RouteParams) => Promise<Response | null>>;
}
```

## Validation Utilities

```typescript
// Generic interface validator
export function createInterfaceValidator<T extends object>(template: T) {
	return class Validator {
		static validate(data: unknown): T {
			// Validates that data only contains keys from template
		}
	};
}

// Generic entity update helper
export async function updateEntity<T extends object>(
	id: string,
	data: unknown,
	validator: { validate: (data: unknown) => T },
	updateFn: (id: string, data: T) => Promise<any>
) {
	const validData = validator.validate(data);
	return updateFn(id, validData);
}
```

## Naming Conventions

| Type                 | Naming Pattern         | Example                           |
| -------------------- | ---------------------- | --------------------------------- |
| Extended Prisma type | `EntityWith[Relation]` | `UserWithRole`, `HomeWithMembers` |
| Create input         | `EntityCreateInput`    | `ActivityCreateInput`             |
| Update input         | `EntityUpdateInput`    | `ActivityUpdateInput`             |
| Query params         | `EntityQueryParams`    | `ActivityQueryParams`             |
| API response         | `EntityResponse`       | `UserResponse`                    |
| Mapper function      | `toEntityResponse`     | `toUserResponse()`                |
