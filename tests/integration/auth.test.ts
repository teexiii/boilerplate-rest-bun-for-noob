import { AppRoleDefault } from '@/data';
import { db } from '@/lib/server/db';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import type { AuthenticatedRequest } from '@/types/auth';
import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';

let server: any;
const TEST_PORT = 3098;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test user data
const testUser = {
	email: `test-${Date.now()}`,
	password: 'Password123!',
	name: 'Test User',
};

// Store tokens for tests
let accessToken: string;
let refreshToken: string;

describe('Auth API Integration Tests', () => {
	beforeAll(async () => {
		// Setup test server
		server = Bun.serve({
			port: TEST_PORT,
			async fetch(req: Request) {
				const match = matchRoute(routes, req as AuthenticatedRequest);

				if (match) {
					const { route, params } = match;

					try {
						// Cast request to AuthenticatedRequest for middleware
						const authReq = req as AuthenticatedRequest;

						// Run middleware
						if (route.middleware && route.middleware.length > 0) {
							for (const middleware of route.middleware) {
								const result = await middleware(authReq, params);
								if (result) {
									// Middleware returned a response, so return it
									return result;
								}
							}
						}
						// Run route handler
						const next = await route.handler(authReq, params);
						const res = await next();

						return res;
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

		// Make sure we have a USER role in the database
		try {
			await db.role.createMany({
				data: [{ name: AppRoleDefault.VIEWER }, { name: AppRoleDefault.ADMIN }],
				// skipDuplicates: true,
			});
		} catch (error) {
			console.log('Roles already exist:', error);
		}
	});

	afterAll(() => {
		// Cleanup
		server.stop();

		// Delete test user
		db.user
			.deleteMany({
				where: {
					email: testUser.email,
				},
			})
			.catch(console.error);
	});

	it('should register a new user', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(testUser),
		});

		expect(response.status).toBe(200);
		const res = await response.json();
		const data = res.data || {};
		expect(data.user).toBeDefined();
		expect(data.user.email).toBe(testUser.email);
		expect(data.accessToken).toBeDefined();
		expect(data.refreshToken).toBeDefined();

		// Save tokens for subsequent tests
		accessToken = data.accessToken;
		refreshToken = data.refreshToken;
	});

	// it("should not register with existing email", async () => {
	//     const response = await fetch(`${BASE_URL}/api/auth/register`, {
	//         method: "POST",
	//         headers: { "Content-Type": "application/json" },
	//         body: JSON.stringify(testUser),
	//     });

	//     expect(response.status).toBe(400);
	//     const res = await response.json();
	//     expect(res.message).toBeDefined();
	// });

	// it("should login with valid credentials", async () => {
	//     const response = await fetch(`${BASE_URL}/api/auth/login`, {
	//         method: "POST",
	//         headers: { "Content-Type": "application/json" },
	//         body: JSON.stringify({
	//             email: testUser.email,
	//             password: testUser.password,
	//         }),
	//     });

	//     expect(response.status).toBe(200);
	//     const res = await response.json();
	//     const data = res.data || {};

	//     expect(data.user).toBeDefined();
	//     expect(data.user.email).toBe(testUser.email);
	//     expect(data.accessToken).toBeDefined();
	//     expect(data.refreshToken).toBeDefined();
	// });

	// it("should not login with invalid credentials", async () => {
	//     const response = await fetch(`${BASE_URL}/api/auth/login`, {
	//         method: "POST",
	//         headers: { "Content-Type": "application/json" },
	//         body: JSON.stringify({
	//             email: testUser.email,
	//             password: "wrongpassword",
	//         }),
	//     });

	//     expect(response.status).toBe(400);
	//     const res = await response.json();
	//     expect(res.message).toBeDefined();
	// });

	// it("should refresh tokens", async () => {
	//     const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
	//         method: "POST",
	//         headers: { "Content-Type": "application/json" },
	//         body: JSON.stringify({
	//             refreshToken,
	//         }),
	//     });

	//     expect(response.status).toBe(200);
	//     const res = await response.json();
	//     const data = res.data || {};

	//     expect(data.accessToken).toBeDefined();
	//     expect(data.refreshToken).toBeDefined();

	//     // Update tokens for subsequent tests
	//     accessToken = data.accessToken;
	//     refreshToken = data.refreshToken;
	// });

	// it("should not refresh with invalid token", async () => {
	//     const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
	//         method: "POST",
	//         headers: { "Content-Type": "application/json" },
	//         body: JSON.stringify({
	//             refreshToken: "invalid-token",
	//         }),
	//     });

	//     expect(response.status).toBe(403);
	//     const res = await response.json();
	//     const data = res.data || {};
	//     expect(res.message).toBeDefined();
	// });

	// it("should logout with valid token", async () => {
	//     console.log('accessToken :>> ', accessToken);
	//     const response = await fetch(`${BASE_URL}/api/auth/logout`, {
	//         method: "POST",
	//         headers: {
	//             "Content-Type": "application/json",
	//             Authorization: `Bearer ${accessToken}`,
	//         },
	//         body: JSON.stringify({
	//             refreshToken,
	//         }),
	//     });

	//     const res = await response.json();
	//     console.log('res :>> ', res);
	//     expect(response.status).toBe(200);
	//     expect(res.message).toBeDefined();
	// });

	// it("should not access protected routes after logout", async () => {
	//     const response = await fetch(`${BASE_URL}/api/profile`, {
	//         method: "GET",
	//         headers: {
	//             Authorization: `Bearer ${accessToken}`,
	//         },
	//     });

	//     // Token might still be valid for a short time depending on your implementation
	//     // In a real test, you might need to check that the token is definitely invalidated
	//     console.log("Profile access response:", await response.text());
	// });
});
