# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**daiPhatXanh-bunapi** is a Bun-based REST API with a layered architecture pattern. It uses Prisma as the ORM, Redis for caching, JWT for authentication, and Pino for logging.

**Stack**: Bun runtime, TypeScript, Prisma ORM, Redis, PostgreSQL

## Essential Architecture: 4-Layer Pattern

**Routes → Handlers → Services → Repositories**

### 1. Routes (`routes/`)

- Define HTTP endpoints with paths, methods, middleware, and handlers
- File naming: `[entity]Routes.ts`
- Export pattern: `export const [entity]Routes: Route[]`
- Import all routes in `routes/index.ts`

### 2. Handlers (`handlers/`)

- Process HTTP requests and responses
- File naming: `[entity]Handler.ts`
- Export pattern: `export const [entity]Handler = { methodName, ... }`
- **Key responsibilities**:
  - Parse request data (body, params, query)
  - Call service layer methods
  - Transform responses using mapper functions
  - Return formatted responses via `success()` helper
- **Always** wrap handler logic in `errorHandler(async () => { ... })`

### 3. Services (`services/`)

- Contain all business logic and validation
- File naming: `[entity]Service.ts`
- Export pattern: `export const [entity]Service = { methodName, ... }`
- **Key responsibilities**:
  - Business logic and validation rules
  - Cross-repository orchestration
  - Throw errors with HTTP status: `throw new Error('msg', { cause: 404 })`
  - Service composition and transaction management

### 4. Repositories (`repositories/`)

- Handle all database operations
- File naming: `[entity]Repo.ts`
- Export pattern: `export const [entity]Repo = { methodName, ... }`
- **Key responsibilities**:
  - CRUD operations (create, update, delete) via Prisma ORM
  - **All `find*` methods MUST use raw SQL** (use `db.$queryRaw` or `db.$queryRawUnsafe`)
  - Query building (filters, sorting, pagination)
  - Relation loading with JOINs in raw SQL
  - Reusable SQL fragments
  - Cache invalidation after mutations

## Creating a New Entity

Follow this order:

1. **`types/[entity].ts`** - Define TypeScript types:

   - Extended Prisma types (e.g., `UserWithRole`)
   - Input types for operations
   - Response/output types
   - Mapper functions (e.g., `toUserResponse()`)

2. **`repositories/[entity]Repo.ts`** - Database access:

   - CRUD methods (create, update, delete use Prisma ORM)
   - **All `find*` methods use raw SQL** (`db.$queryRaw`)
   - Query helpers with raw SQL
   - Reusable SQL fragments
   - Cache management

3. **`services/[entity]Service.ts`** - Business logic:

   - Validation
   - Use repository methods
   - Error handling with `.cause`

4. **`handlers/[entity]Handler.ts`** - HTTP layer:

   - Request parsing
   - Call service methods
   - Use mapper functions
   - Wrap in `errorHandler()`

5. **`routes/[entity]Routes.ts`** - Route definitions:

   - Define paths, methods, middleware
   - Reference handler methods

6. **`routes/index.ts`** - Import and export new routes

7. **`tests/integration/[entity].test.ts`** - Integration tests

## Error Handling Pattern

Services throw errors with HTTP status codes:

```typescript
throw new Error('User not found', { cause: 404 });
throw new Error('Email already taken', { cause: 400 });
```

Handlers wrap async logic in `errorHandler()`:

```typescript
getUserById: async (req, params) =>
	errorHandler(async () => {
		const user = await userService.getUserById(params.id);
		return success({ data: toUserResponse(user) });
	});
```

## Response Format

All successful responses use:

```typescript
return success({ data: /* your data */ });
```

Output format:

```json
{
	"status": true,
	"data": {
		/* response data */
	}
}
```

## Middleware

- Defined in `middleware/` directory
- Multiple middleware per route supported
- Return `Response` to stop execution (e.g., authentication failure)
- Return `null` to continue to next middleware/handler
- Common middleware: `authenticate`, `requireAdmin`, etc.

## Caching

- Repository-level caching using Redis
- Cache utilities in `caching/` directory
- **Always invalidate cache** after mutations (create, update, delete)
- Cache keys typically include entity ID and unique fields (e.g., email)

## Authentication & Authorization

- JWT-based authentication in `lib/auth/`
- Password hashing with bcryptjs
- Middleware: `authenticate` validates JWT tokens
- Use `AuthenticatedRequest` type for protected routes
- User context available as `req.user` after authentication

## Testing

- Integration tests in `tests/integration/`
- Use `.env.test.local` for test environment
- Tests follow pattern:
  - `beforeAll()`: Setup server, seed test data
  - `afterAll()`: Cleanup server, delete test data
  - Test HTTP endpoints with `fetch()`
  - Assert response status and data structure

## Key Directories

- `routes/` - Route definitions
- `handlers/` - HTTP request handlers
- `services/` - Business logic
- `repositories/` - Data access layer
- `types/` - TypeScript type definitions
- `middleware/` - Request middleware
- `lib/` - Utilities (auth, response helpers, etc.)
- `caching/` - Cache management
- `config/` - Configuration files
- `prisma/` - Database schema and migrations
- `tests/integration/` - Integration tests

## Important Notes

- Uses Bun runtime (not Node.js)
- TypeScript configuration requires type checking: `bun run lint` includes `tsc --noEmit`
- Prisma client auto-generated on `postinstall`
- Server entry point: `index.ts`
- All dates handled with `dayjs` library
- Logging with Pino (structured JSON logs)
- Image processing available via Sharp library
