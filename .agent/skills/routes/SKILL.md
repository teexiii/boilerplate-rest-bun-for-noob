---
name: routes
description: 'Route definitions, middleware stacking, and parameter syntax'
slug: routes
---

# Routes Layer Guide

This guide covers route definitions in the `routes/` directory.

## Route Interface

```typescript
export interface Route {
	path: string;
	method: string;
	handler: RouteHandler;
	middleware?: Array<(req: AuthenticatedRequest, params: RouteParams) => Promise<Response | null>>;
}
```

## Basic Route Definition

```typescript
// routes/homeRoutes.ts
import type { Route } from '@/types/auth';
import { homeHandler } from '@/handlers/homeHandler';
import { authenticate, requireHash } from '@/middleware/auth';

export const homeRoutes: Route[] = [
	{
		path: '/api/homes',
		method: 'POST',
		middleware: [requireHash, authenticate],
		handler: homeHandler.create,
	},
	{
		path: '/api/homes/:id',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: homeHandler.getById,
	},
	{
		path: '/api/homes/:id',
		method: 'PUT',
		middleware: [requireHash, authenticate],
		handler: homeHandler.update,
	},
	{
		path: '/api/homes/:id',
		method: 'DELETE',
		middleware: [requireHash, authenticate],
		handler: homeHandler.delete,
	},
];
```

## Middleware Stacking

Middleware executes in order. Return `null` to continue, or `Response` to stop.

### Common Patterns

```typescript
// Public endpoint with hash verification
{
    path: '/api/auth/login',
    method: 'POST',
    middleware: [requireHash],
    handler: authHandler.login,
}

// Protected endpoint (most common)
{
    path: '/api/profile',
    method: 'PUT',
    middleware: [requireHash, authenticate],
    handler: userHandler.updateProfile,
}

// Admin-only endpoint
const adminMiddleware = [requireHash, authenticate, requireAdmin];

{
    path: '/api/admin/dashboard',
    method: 'GET',
    middleware: adminMiddleware,
    handler: adminHandler.dashboard,
}

// Self-or-admin access
{
    path: '/api/users/:id',
    method: 'GET',
    middleware: [requireHash, authenticate, requireSelfOrAdmin('id')],
    handler: userHandler.getUserById,
}
```

### Available Middleware

| Middleware                         | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| `requireHash`                      | Validate request signature           |
| `authenticate`                     | Validate JWT, populate `req.user`    |
| `optionalAuthenticate`             | Populate `req.user` if token present |
| `requireAdmin`                     | Require admin role                   |
| `requireAdminOrPro`                | Require admin or pro role            |
| `requireRoles(['ROLE1', 'ROLE2'])` | Require specific roles               |
| `requireSelfOrAdmin('paramName')`  | Allow self or admin access           |

## Parameter Syntax

### Simple Parameters

```typescript
// Single parameter
{
    path: '/api/babies/:id',
    method: 'GET',
    handler: babyHandler.getById,
}

// Multiple parameters
{
    path: '/api/homes/:id/members/:userId',
    method: 'DELETE',
    handler: homeHandler.removeMember,
}
```

### Nested Resources

```typescript
// Babies under homes
{
    path: '/api/homes/:homeId/babies',
    method: 'GET',
    handler: babyHandler.getByHomeId,
}

{
    path: '/api/homes/:homeId/babies',
    method: 'POST',
    handler: babyHandler.create,
}

// Activities under babies
{
    path: '/api/babies/:babyId/activities',
    method: 'GET',
    handler: activityHandler.getByBabyId,
}
```

### Code-Based Routes (IMPORTANT)

**If a schema has a `code` field, you MUST create `/code/:code` routes** alongside the standard `:id` routes. Code-based access is the primary way clients reference resources (short, shareable identifiers via `toBase62`).

```typescript
// REQUIRED: By code routes for entities with `code` field
{
    path: '/api/homes/code/:code',
    method: 'GET',
    handler: homeHandler.getByCode,
}

// REQUIRED: Nested child resources must also be accessible via parent's code
{
    path: '/api/homes/code/:code/babies',
    method: 'GET',
    handler: babyHandler.getByHomeCode,
}

{
    path: '/api/babies/code/:code',
    method: 'GET',
    handler: babyHandler.getByCode,
}

{
    path: '/api/babies/code/:code/activities',
    method: 'GET',
    handler: activityHandler.getByBabyCode,
}
```

> **Rule**: When adding a new entity with a `code` field in its Prisma schema, always add both `:id` and `/code/:code` route variants. Also add `/code/:code` variants for any nested resources under that entity.

## Route Ordering (Critical)

Routes match in order - specific routes must come before generic patterns:

```typescript
// routes/homeInviteRoutes.ts
export const homeInviteRoutes: Route[] = [
	// SPECIFIC: /api/invites/me (must come first!)
	{
		path: '/api/invites/me',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: homeInviteHandler.getMyInvites,
	},
	// GENERIC: /api/invites/:id (would match "me" if first)
	{
		path: '/api/invites/:id/detail',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: homeInviteHandler.getById,
	},
];
```

```typescript
// routes/index.ts - Order matters here too
export const routes: Route[] = [
	...defaultRoutes,
	...authRoutes,
	...homeInviteRoutes, // Must come before homeRoutes
	...homeRoutes,
	...babyRoutes,
	...activityRoutes,
	// ...
];
```

## Central Route Registration

All routes are collected in `routes/index.ts`:

```typescript
import { authRoutes } from '@/routes/authRoutes';
import { userRoutes } from '@/routes/userRoutes';
import { homeRoutes } from '@/routes/homeRoutes';
import { babyRoutes } from '@/routes/babyRoutes';
import { activityRoutes } from '@/routes/activityRoutes';
import type { Route } from '@/types/auth';

export const routes: Route[] = [
	...defaultRoutes,
	...authRoutes,
	...userRoutes,
	...homeInviteRoutes, // Order matters
	...homeRoutes,
	...babyRoutes,
	...activityRoutes,
	...adminRoutes,
];
```

## Complete CRUD Example

```typescript
// routes/babyRoutes.ts
import type { Route } from '@/types/auth';
import { babyHandler } from '@/handlers/babyHandler';
import { authenticate, requireHash } from '@/middleware/auth';

export const babyRoutes: Route[] = [
	// CREATE - under home
	{
		path: '/api/homes/:homeId/babies',
		method: 'POST',
		middleware: [requireHash, authenticate],
		handler: babyHandler.create,
	},
	// READ - list by home
	{
		path: '/api/homes/:homeId/babies',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: babyHandler.getByHomeId,
	},
	// READ - single by ID
	{
		path: '/api/babies/:id',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: babyHandler.getById,
	},
	// UPDATE
	{
		path: '/api/babies/:id',
		method: 'PUT',
		middleware: [requireHash, authenticate],
		handler: babyHandler.update,
	},
	// PATCH (partial update)
	{
		path: '/api/babies/:id',
		method: 'PATCH',
		middleware: [requireHash, authenticate],
		handler: babyHandler.update,
	},
	// DELETE
	{
		path: '/api/babies/:id',
		method: 'DELETE',
		middleware: [requireHash, authenticate],
		handler: babyHandler.delete,
	},
];
```

## File Naming Convention

- File: `routes/[entity]Routes.ts`
- Export: `export const [entity]Routes: Route[]`
- Always import in `routes/index.ts`

## HTTP Methods

Every entity should typically support:

| Method   | Purpose          | Example Path      |
| -------- | ---------------- | ----------------- |
| `POST`   | Create           | `/api/babies`     |
| `GET`    | Read (list)      | `/api/babies`     |
| `GET`    | Read (single)    | `/api/babies/:id` |
| `PUT`    | Update (full)    | `/api/babies/:id` |
| `PATCH`  | Update (partial) | `/api/babies/:id` |
| `DELETE` | Delete           | `/api/babies/:id` |
