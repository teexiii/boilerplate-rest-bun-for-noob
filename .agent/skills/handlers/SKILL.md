---
name: handlers
description: 'HTTP request handling and response formatting'
slug: handlers
---

# Handler Layer Guide

This guide covers HTTP request handling in the `handlers/` directory.

## Core Structure

Handlers process HTTP requests and return responses:

```typescript
export const userHandler = {
	getUserById: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const user = await userService.getUserById(params.id);
			return success({ data: toUserResponse(user) });
		}),
};
```

## errorHandler() Wrapper

Always wrap handler logic in `errorHandler()`:

```typescript
import { errorHandler } from '@/middleware/error';

create: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        // Handler logic here
        // Errors are caught and formatted automatically
    }),
```

The `errorHandler()` function:

- Catches JSON parsing errors (400)
- Handles service errors with `.cause` property
- Handles Prisma errors (P2002 conflict, P2025 not found)
- Returns 500 for unexpected errors

## Request Parsing

### Body Parsing (JSON)

```typescript
create: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        const body = await req.json();  // Parse JSON body

        // Validate required fields
        if (!body.name) return fail400('Name is required');
        if (!body.birthDate) return fail400('Birth date is required');

        const baby = await babyService.createBaby(req.user.id, {
            ...body,
            birthDate: new Date(body.birthDate),  // Transform types
            homeId: params.homeId,
        });

        return success({ data: toBabyResponse(baby) });
    }),
```

### Route Parameters

```typescript
// Route: /api/users/:id
getUserById: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        const user = await userService.getUserById(params.id);
        return success({ data: toUserResponse(user) });
    }),

// Route: /api/homes/:homeId/babies
getByHomeId: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        const babies = await babyService.getBabiesByHomeId(
            params.homeId,  // From route
            req.user!.id
        );
        return success({ data: babies.map(toBabyResponse) });
    }),
```

### Query Parameters

```typescript
getByBabyId: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const type = url.searchParams.get('type') as ActivityType | null;

        const activities = await activityService.getActivitiesByBabyId(
            params.babyId,
            req.user.id,
            { limit, offset, type: type || undefined }
        );

        return success({ data: activities.map(toActivityResponse) });
    }),
```

## Response Formatting

### success() Helper

```typescript
import { success, fail, fail400, fail401, fail403 } from '@/lib/response';

// Data only
return success({ data: toBabyResponse(baby) });
// Response: { "status": true, "data": { ... } }

// Message and data
return success({
	message: 'Member added successfully',
	data: result,
});
// Response: { "status": true, "message": "...", "data": { ... } }

// Message only
return success({ message: 'Media deleted successfully' });
// Response: { "status": true, "message": "..." }
```

### Failure Responses

```typescript
// 400 - Bad Request
return fail400('Name is required');

// 401 - Unauthorized
return fail401('Authentication required');

// 403 - Forbidden
return fail403('Access denied');

// Generic with status
return fail('Custom error message', 422);
```

## Mapper Function Usage

Transform service responses before returning:

```typescript
// Single item
getUserById: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        const user = await userService.getUserById(params.id);
        return success({ data: toUserResponse(user) });
    }),

// List of items
getAllUsers: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const result = await userService.getAllUsers(page, limit);
        const list = result.list.map((x) => toUserResponse(x));

        return success({
            data: {
                ...result,
                list,
            },
        });
    }),
```

## AuthenticatedRequest Usage

### Type Definition

```typescript
export interface AuthenticatedRequest extends Request {
	user?: UserInRequest;
	log?: RequestLogger;
	logEnd?: (statusCode: number, error?: any) => void;
	clientIp?: string | null;
}

export interface UserInRequest extends UserWithRole {
	isAdmin: boolean;
}
```

### Checking Authentication

```typescript
create: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        // Check if user is authenticated
        if (!req.user) return fail401('Authentication required');

        // Use user ID
        const baby = await babyService.createBaby(req.user.id, body);

        return success({ data: toBabyResponse(baby) });
    }),
```

### Checking Admin Status

```typescript
adminOnlyAction: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        // Check admin via middleware (preferred)
        // Or check inline:
        if (!req.user.isAdmin) return fail403('Admin access required');

        // Admin-only logic...
    }),
```

## Common Handler Patterns

### Create Handler

```typescript
create: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        const body = await req.json();

        // Validate required fields
        if (!body.name) return fail400('Name is required');

        const entity = await entityService.create(req.user.id, body);
        return success({ data: toEntityResponse(entity) });
    }),
```

### Get By ID Handler

```typescript
getById: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        const entity = await entityService.getById(params.id, req.user.id);
        return success({ data: toEntityResponse(entity) });
    }),
```

### List Handler with Pagination

```typescript
list: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');

        const result = await entityService.list(req.user.id, { page, limit });

        return success({
            data: {
                ...result,
                list: result.list.map(toEntityResponse),
            },
        });
    }),
```

### Update Handler

```typescript
update: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        const body = await req.json();
        const entity = await entityService.update(params.id, req.user.id, body);
        return success({ data: toEntityResponse(entity) });
    }),
```

### Delete Handler

```typescript
delete: async (req: AuthenticatedRequest, params: RouteParams) =>
    errorHandler(async () => {
        if (!req.user) return fail401('Authentication required');

        await entityService.delete(params.id, req.user.id);
        return success({ message: 'Deleted successfully' });
    }),
```

## File Naming Convention

- File: `handlers/[entity]Handler.ts`
- Export: `export const [entity]Handler = { ... }`
- Methods: `create`, `getById`, `list`, `update`, `delete`, etc.
