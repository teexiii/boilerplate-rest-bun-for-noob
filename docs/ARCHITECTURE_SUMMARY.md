# Architecture Patterns Summary

## Layered Architecture (4-Layer Pattern)

Routes → Handlers → Services → Repositories

---

## 1. ROUTES (locations/endpoints)

**Location**: `routes/`
**Naming**: `[entity]Routes.ts`
**Export**: `export const [entity]Routes: Route[]`

Structure:

```typescript
export const userRoutes: Route[] = [
	{
		path: '/api/users/:id',
		method: 'GET',
		middleware: [authenticate, requireAdmin],
		handler: userHandler.getUserById,
	},
];
```

---

## 2. HANDLERS (HTTP request processing)

**Location**: `handlers/`
**Naming**: `[entity]Handler.ts`
**Export**: `export const [entity]Handler = { methodName, ... }`

Structure:

```typescript
export const userHandler = {
	getUserById: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const user = await userService.getUserById(params.id);
			return success({ data: toUserReponse(user) });
		}),
};
```

Responsibilities:

- Parse request (body, params, query)
- Call service layer
- Transform response
- Return formatted response

---

## 3. SERVICES (business logic)

**Location**: `services/`
**Naming**: `[entity]Service.ts`
**Export**: `export const [entity]Service = { methodName, ... }`

Structure:

```typescript
export const userService = {
	async getUserById(id: string) {
		const user = await userRepo.findById(id);
		if (!user) throw new Error('Not found', { cause: 404 });
		return user;
	},

	async updateUser(id: string, data: UserUpdateInput) {
		// Validation
		if (data.email) {
			const exists = await userRepo.findByEmail(data.email);
			if (exists && exists.id !== id) {
				throw new Error('Email taken', { cause: 400 });
			}
		}
		// Persistence
		return userRepo.update(id, data);
	},
};
```

Responsibilities:

- Business logic & validation
- Cross-repo orchestration
- Error handling (with HTTP status via `.cause`)
- Service composition

---

## 4. REPOSITORIES (data access)

**Location**: `repositories/`
**Naming**: `[entity]Repo.ts`
**Export**: `export const [entity]Repo = { methodName, ... }`

Structure:

```typescript
export const userRepo = {
	async findById(id: string) {
		return db.user.findUnique({
			where: { id },
			include: { role: true },
		});
	},

	async findAll({ limit, offset }) {
		return db.user.findMany({
			include: { role: true },
			take: limit,
			skip: offset,
		});
	},

	async create(data: UserCreateInput) {
		const user = await db.user.create({ data, include: { role: true } });
		await userCache.clear(user.id, user.email);
		return user;
	},
};
```

Responsibilities:

- CRUD operations
- Query building (filters, sorting, pagination)
- Relations loading (include)
- Cache invalidation
- Raw SQL for complex queries

---

## 5. TYPES (TypeScript definitions)

**Location**: `types/`
**Naming**: `[entity].ts` (e.g., user.ts, auth.ts)

Structure:

```typescript
// Database model extension
export type UserWithRole = User & { role: Role };

// Input type
export interface UserCreateInput {
	email: string;
	password: string;
	name?: string;
	roleId: string;
}

// Output type
export interface UserResponse {
	id: string;
	email: string;
	role: { id: string; name: string };
}

// Mapper function
export const toUserReponse = (user: UserWithRole): UserResponse => ({
	id: user.id,
	email: user.email,
	role: { id: user.role.id, name: user.role.name },
});
```

Responsibilities:

- Extend Prisma types
- Define request/response shapes
- Provide mappers/transformers

---

## 6. TESTS (integration tests)

**Location**: `tests/integration/`
**Naming**: `[feature].test.ts`

Structure:

```typescript
describe('User API', () => {
  beforeAll(async () => {
    // Setup server, seed data
    server = Bun.serve({ ... });
    user = await userService.createUser(...);
  });

  afterAll(async () => {
    // Cleanup
    server.stop();
    await db.user.deleteMany(...);
  });

  it('should get user', async () => {
    const res = await fetch(`${BASE}/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status).toBe(200);
  });
});
```

---

## Full Stack Example: GET User

**Route** → `userRoutes.ts`

```typescript
{ path: '/api/users/:id', method: 'GET', handler: userHandler.getUserById }
```

**Handler** → `userHandler.ts`

```typescript
getUserById: async (req, params) =>
	errorHandler(async () => {
		const user = await userService.getUserById(params.id);
		return success({ data: toUserReponse(user) });
	});
```

**Service** → `userService.ts`

```typescript
async getUserById(id: string) {
  const user = await userRepo.findById(id);
  if (!user) throw new Error('Not found', { cause: 404 });
  return user;
}
```

**Repository** → `userRepo.ts`

```typescript
async findById(id: string) {
  return db.user.findUnique({
    where: { id },
    include: { role: true }
  });
}
```

**Types** → `types/user.ts`

```typescript
export type UserWithRole = User & { role: Role };
export interface UserResponse { id, email, role }
export const toUserReponse = (user) => ({ ... });
```

**Test** → `tests/integration/user.test.ts`

```typescript
it('should get user', async () => {
	const res = await fetch(`${BASE_URL}/api/users/${userId}`);
	expect(res.status).toBe(200);
});
```

---

## Key Patterns

### Error Handling

- Service throws: `throw new Error('msg', { cause: 404 })`
- Handler wraps: `errorHandler(async () => { ... })`
- Response: `{ status: false, message: 'msg' }`

### Response Format

```json
{
	"status": true,
	"data": {
		/* data */
	}
}
```

### Middleware

- Multiple middleware per route
- Return `Response` to stop execution
- Return `null` to continue to next

### Caching

- Repository-level caching (userCache)
- Invalidate on mutations

---

## File Paths

| Component    | Pattern                               | Examples                       |
| ------------ | ------------------------------------- | ------------------------------ |
| Routes       | `routes/[entity]Routes.ts`            | userRoutes.ts, authRoutes.ts   |
| Handlers     | `handlers/[entity]Handler.ts`         | userHandler.ts, authHandler.ts |
| Services     | `services/[entity]Service.ts`         | userService.ts, authService.ts |
| Repositories | `repositories/[entity]Repo.ts`        | userRepo.ts, roleRepo.ts       |
| Types        | `types/[entity].ts`                   | user.ts, auth.ts, role.ts      |
| Tests        | `tests/integration/[feature].test.ts` | user.test.ts, auth.test.ts     |

---

## Directory Structure

```
daiPhatXanh-bunapi/
├── routes/                 # Route definitions
├── handlers/              # Request handlers
├── services/              # Business logic
├── repositories/          # Data access
├── types/                 # Type definitions
├── tests/integration/     # Integration tests
├── middleware/            # Auth, error, logging
├── lib/                   # Utilities
│   ├── auth/             # JWT, passwords
│   ├── response/         # Response helpers
│   └── utils/            # Router, UUID, etc.
├── caching/              # Cache management
├── config/               # Configuration
├── prisma/               # Database schema
└── index.ts              # Server entry point
```

---

## Creating a New Entity

1. **types/[entity].ts** - Input/Output types, mappers
2. **repositories/[entity]Repo.ts** - CRUD & queries
3. **services/[entity]Service.ts** - Business logic
4. **handlers/[entity]Handler.ts** - HTTP handling
5. **routes/[entity]Routes.ts** - Endpoint definitions
6. **tests/integration/[entity].test.ts** - Tests
7. **routes/index.ts** - Import new routes
