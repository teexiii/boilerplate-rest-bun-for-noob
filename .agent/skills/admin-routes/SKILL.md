---
name: admin-routes
description: 'Admin panel routes with shared middleware and entity patterns'
slug: admin-routes
---

# Admin Routes Guide

This guide covers admin panel routes and handler patterns in `routes/adminRoutes.ts` and `handlers/adminHandler.ts`.

## Shared Admin Middleware

All admin routes use a single middleware stack:

```typescript
import { authenticate, requireAdmin } from '@/middleware/auth';
import { requireHash } from '@/middleware/security';

const adminMiddleware = [requireHash, authenticate, requireAdmin];
```

## Route Pattern Per Entity

Every entity exposed to the admin panel follows the same 3-endpoint pattern:

```typescript
// LIST - paginated
{
    path: '/api/admin/[entities]',
    method: 'GET',
    middleware: adminMiddleware,
    handler: adminHandler.list[Entities],
}

// GET BY ID - detailed view
{
    path: '/api/admin/[entities]/:id',
    method: 'GET',
    middleware: adminMiddleware,
    handler: adminHandler.get[Entity]ById,
}

// DELETE
{
    path: '/api/admin/[entities]/:id',
    method: 'DELETE',
    middleware: adminMiddleware,
    handler: adminHandler.delete[Entity],
}
```

Some entities have additional operations (e.g., tickets also have `PATCH` for status updates).

## Section Organization

Routes are organized with section comment headers per entity:

```typescript
export const adminRoutes: Route[] = [
	// =====================================================
	// DASHBOARD ANALYTICS
	// =====================================================
	{
		path: '/api/admin/dashboard',
		method: 'GET',
		middleware: adminMiddleware,
		handler: adminHandler.dashboard,
	},

	// =====================================================
	// HOME
	// =====================================================
	{
		path: '/api/admin/homes',
		method: 'GET',
		middleware: adminMiddleware,
		handler: adminHandler.listHomes,
	},
	{
		path: '/api/admin/homes/:id',
		method: 'GET',
		middleware: adminMiddleware,
		handler: adminHandler.getHomeById,
	},
	{
		path: '/api/admin/homes/:id',
		method: 'DELETE',
		middleware: adminMiddleware,
		handler: adminHandler.deleteHome,
	},

	// =====================================================
	// [NEXT ENTITY]
	// =====================================================
	// ...
];
```

## Handler Pattern

### Pagination Helper

All list handlers parse pagination from query params:

```typescript
getPagination(req: AuthenticatedRequest): { page: number; limit: number; offset: number } {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}
```

### List Handler

```typescript
listHomes: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        const { page, limit, offset } = getPagination(req);
        const result = await adminService.listHomes({ page, limit, offset });
        return success({ data: result });
    }),
```

### Get By ID Handler

```typescript
getHomeById: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        const home = await adminService.getHomeById(params.id);
        return success({ data: home });
    }),
```

### Delete Handler

```typescript
deleteHome: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        await adminService.deleteHome(params.id);
        return success({ message: 'Home deleted' });
    }),
```

## Architecture Layers

Admin follows the same 4-layer architecture but with separate files:

| Layer   | File                        | Pattern                                                              |
| ------- | --------------------------- | -------------------------------------------------------------------- |
| Route   | `routes/adminRoutes.ts`     | `adminMiddleware` + section-grouped CRUD                             |
| Handler | `handlers/adminHandler.ts`  | Single handler object with all entity methods                        |
| Service | `services/adminService.ts`  | Orchestrates admin-specific logic                                    |
| Repo    | `repositories/adminRepo.ts` | Admin-specific queries (list with pagination, detail views)          |
| Types   | `types/admin.ts`            | `Admin[Entity]ListItem`, `Admin[Entity]Detail`, `PaginatedResult<T>` |

## Type Naming Convention

Admin types use a distinct naming pattern:

```typescript
// List items (minimal fields for table display)
export type AdminHomeListItem = { ... };
export type AdminBabyListItem = { ... };

// Detail views (full entity with relations)
export type AdminHomeDetail = { ... };
export type AdminBabyDetail = { ... };

// Paginated wrapper
export type PaginatedResult<T> = {
    list: T[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
};
```

## Adding a New Admin Entity

When adding a new Prisma model to the admin panel:

1. **Types**: Add `Admin[Entity]ListItem` and `Admin[Entity]Detail` to `types/admin.ts`
2. **Repo**: Add `list[Entities]()`, `get[Entity]ById()`, `delete[Entity]()` to `repositories/adminRepo.ts`
3. **Service**: Add matching methods to `services/adminService.ts`
4. **Handler**: Add `list[Entities]`, `get[Entity]ById`, `delete[Entity]` to `handlers/adminHandler.ts`
5. **Routes**: Add 3 routes (GET list, GET by ID, DELETE) section to `routes/adminRoutes.ts`
6. **Swagger**: Add admin paths to `swagger/spec.ts` under the `Admin` tag
