---
name: tests
description: 'Integration testing patterns with Bun.serve'
slug: tests
---

# Testing Guide

This guide covers integration testing patterns in `tests/integration/`.

## Test File Structure

```
tests/
├── integration/          # Full API endpoint tests
│   ├── auth.test.ts
│   ├── user.test.ts
│   ├── baby.test.ts
│   ├── activity.test.ts
│   ├── home.test.ts
│   └── ...
└── apiToken.test.ts      # Standalone procedural test
```

## Server Setup with Bun.serve()

Each test file creates its own server on a unique port:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db, initDb } from '@/lib/server/db';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import { generateAccessToken } from '@/lib/auth/jwt';
import type { AuthenticatedRequest } from '@/types/auth';
import { AppRoleDefault } from '@/data';

let server: any;
const TEST_PORT = 3098; // Unique port per test file
const BASE_URL = `http://localhost:${TEST_PORT}`;

beforeAll(async () => {
	await initDb();

	server = Bun.serve({
		port: TEST_PORT,
		async fetch(req: Request) {
			const match = matchRoute(routes, req as AuthenticatedRequest);

			if (match) {
				const { route, params } = match;

				try {
					const authReq = req as AuthenticatedRequest;

					// Run middleware
					if (route.middleware && route.middleware.length > 0) {
						for (const middleware of route.middleware) {
							const result = await middleware(authReq, params);
							if (result) return result; // Middleware returned error
						}
					}

					// Run handler
					const next = await route.handler(authReq, params);
					return await next();
				} catch (error) {
					console.error('Test server error:', error);
					return new Response(JSON.stringify({ error: 'Internal server error' }), {
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					});
				}
			}

			return new Response(JSON.stringify({ error: 'Not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		},
	});

	// Ensure roles exist
	for (const roleName of [AppRoleDefault.VIEWER, AppRoleDefault.ADMIN]) {
		await db.role.upsert({
			where: { name: roleName },
			update: {},
			create: { name: roleName },
		});
	}
});

afterAll(async () => {
	server.stop();
	// Cleanup test data...
});
```

## Test Data Patterns

### Unique Emails with Date.now()

```typescript
const testUser = {
	email: `temp-baby-user-${Date.now()}@test.com`,
	password: 'BabyPass123!',
	name: 'Baby User',
};

const outsiderUser = {
	email: `temp-baby-outsider-${Date.now()}@test.com`,
	password: 'OutsiderPass123!',
	name: 'Outsider',
};
```

### Multiple Users for Authorization Testing

```typescript
// Store IDs and tokens
let ownerId: string;
let memberId: string;
let outsiderId: string;
let ownerToken: string;
let memberToken: string;
let outsiderToken: string;
let testHomeId: string;
let testBabyId: string;

beforeAll(async () => {
	// ... server setup ...

	// Create test users
	const owner = await userService.createUser(ownerUser);
	const member = await userService.createUser(memberUser);
	const outsider = await userService.createUser(outsiderUser);

	ownerId = owner.id;
	memberId = member.id;
	outsiderId = outsider.id;

	ownerToken = await generateAccessToken(owner);
	memberToken = await generateAccessToken(member);
	outsiderToken = await generateAccessToken(outsider);

	// Create test home
	const home = await homeService.createHome(ownerId, { name: 'Test Home' });
	testHomeId = home.id;
});
```

## HTTP Assertions

### Standard Response Testing

```typescript
it('should register a new user', async () => {
	const response = await fetch(`${BASE_URL}/api/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(testUser),
	});

	expect(response.status).toBe(200);
	const res = await response.json();

	expect(res.status).toBe(true);
	expect(res.data.user).toBeDefined();
	expect(res.data.user.email).toBe(testUser.email);
	expect(res.data.session.accessToken).toBeDefined();
	expect(res.data.session.refreshToken).toBeDefined();

	// Save tokens for subsequent tests
	accessToken = res.data.session.accessToken;
	refreshToken = res.data.session.refreshToken;
});
```

### Authenticated Request Testing

```typescript
it('should create a new baby', async () => {
	const response = await fetch(`${BASE_URL}/api/homes/${testHomeId}/babies`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${userToken}`,
		},
		body: JSON.stringify({
			name: 'Baby Emma',
			birthDate: '2024-06-15',
			gender: 'FEMALE',
		}),
	});

	expect(response.status).toBe(200);
	const res = await response.json();

	expect(res.status).toBe(true);
	expect(res.data.name).toBe('Baby Emma');
	expect(res.data.gender).toBe('FEMALE');
	expect(res.data.code).toBeDefined();

	testBabyId = res.data.id;
	testBabyCode = res.data.code;
});
```

### Authorization Denial Testing

```typescript
it('should reject outsider creating baby', async () => {
	const response = await fetch(`${BASE_URL}/api/homes/${testHomeId}/babies`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${outsiderToken}`,
		},
		body: JSON.stringify({
			name: 'Baby Test',
			birthDate: '2024-06-15',
		}),
	});

	expect(response.status).toBe(403);
});
```

### Error Response Testing

```typescript
it('should return 400 for missing required field', async () => {
	const response = await fetch(`${BASE_URL}/api/babies`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${userToken}`,
		},
		body: JSON.stringify({
			// Missing required 'name' field
			birthDate: '2024-06-15',
		}),
	});

	expect(response.status).toBe(400);
	const res = await response.json();
	expect(res.status).toBe(false);
});

it('should return 404 for non-existent resource', async () => {
	const response = await fetch(`${BASE_URL}/api/babies/non-existent-id`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${userToken}`,
		},
	});

	expect(response.status).toBe(404);
});
```

## Nested Describe Blocks

Organize related tests:

```typescript
describe('Auth API Integration Tests', () => {
	beforeAll(async () => {
		/* server setup */
	});
	afterAll(() => {
		/* cleanup */
	});

	it('should register a new user', async () => {
		/* ... */
	});
	it('should login with valid credentials', async () => {
		/* ... */
	});

	describe('Email Verification', () => {
		let verificationToken: string;

		it('should register and send verification email', async () => {
			// ...
			verificationToken = res.data.token;
		});

		it('should verify email with valid token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
				method: 'POST',
				body: JSON.stringify({ token: verificationToken }),
			});
			expect(response.status).toBe(200);
		});
	});

	describe('Password Reset', () => {
		let resetToken: string;

		beforeAll(async () => {
			/* setup */
		});

		it('should initiate forgot password flow', async () => {
			/* ... */
		});
		it('should reset password with valid token', async () => {
			/* ... */
		});
	});
});
```

## Cleanup in afterAll

```typescript
afterAll(async () => {
	server.stop();

	// Delete test data in order (respect foreign keys)
	await db.activity.deleteMany({
		where: { baby: { name: { contains: 'Test Baby' } } },
	});

	await db.baby.deleteMany({
		where: { name: { contains: 'Test Baby' } },
	});

	await db.home.deleteMany({
		where: { name: { contains: 'Test' } },
	});

	await db.user.deleteMany({
		where: {
			email: { in: [testUser.email, outsiderUser.email] },
		},
	});
});
```

## Test Configuration

### package.json Scripts

```json
{
	"scripts": {
		"test": "bun --env-file=.env.test.local test --coverage",
		"test:setup": "bun --env-file=.env.test.local run prisma/test-setup.ts"
	}
}
```

### .env.test.local

```env
PORT=3082
NODE_ENV=development
ENV=local
DATABASE_URL="postgres://myuser:mypassword@localhost:5432/test"
REDIS_DB=0
```

## Common Imports

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { AppRoleDefault } from '@/data';
import { db, initDb } from '@/lib/server/db';
import { generateAccessToken } from '@/lib/auth/jwt';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import { userService } from '@/services/userService';
import { homeService } from '@/services/homeService';
import { babyService } from '@/services/babyService';
import type { AuthenticatedRequest } from '@/types/auth';
```

## Best Practices

1. **Unique ports** - Each test file uses a different port (3088, 3091, 3092, etc.)
2. **Unique emails** - Use `Date.now()` to avoid conflicts
3. **Role setup** - Use `upsert` to ensure roles exist
4. **Token generation** - Generate tokens directly, don't go through auth flow
5. **Multiple users** - Test with owner, member, and outsider roles
6. **Cleanup order** - Delete in order to respect foreign keys
7. **Status checks** - Always check both HTTP status and `res.status`
8. **Save IDs** - Store created entity IDs for use in later tests
