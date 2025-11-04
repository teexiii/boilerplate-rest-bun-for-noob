import { AppRoleDefault } from '@/data';
import { db } from '@/lib/server/db';
import { generateAccessToken } from '@/lib/auth/jwt';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import { userService } from '@/services/userService';
import type { AuthenticatedRequest } from '@/types/auth';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';

let server: any;
const TEST_PORT = 3088;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test user data
const adminUser = {
	email: `temp-admin-${Date.now()}`,
	password: 'AdminPass123!',
	name: 'Admin User',
};

const regularUser = {
	email: `temp-${Date.now()}`,
	password: 'UserPass123!',
	name: 'Regular User',
};

// Store IDs and tokens
let adminId: string;
let userId: string;
let adminToken: string;
let userToken: string;

describe('User API Integration Tests', () => {
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

		// Make sure roles exist
		try {
			// Create roles one by one since MongoDB doesn't support skipDuplicates
			for (const roleName of [AppRoleDefault.VIEWER, AppRoleDefault.ADMIN]) {
				await db.role.upsert({
					where: { name: roleName },
					update: {},
					create: { name: roleName },
				});
			}
		} catch (error) {
			console.log('Error creating roles:', error);
		}

		// Get role IDs
		const adminRole = await db.role.findUnique({ where: { name: AppRoleDefault.ADMIN } });
		const userRole = await db.role.findUnique({ where: { name: AppRoleDefault.VIEWER } });

		if (!adminRole || !userRole) {
			throw new Error('Required roles not found');
		}

		const admin = await userService.createAdmin({
			email: adminUser.email,
			password: adminUser.password,
			name: adminUser.name,
		});

		const user = await userService.createUser({
			email: regularUser.email,
			password: regularUser.password,
			name: regularUser.name,
		});

		adminId = admin.id;
		userId = user.id;

		adminToken = await generateAccessToken(admin);
		userToken = await generateAccessToken(user);
	});

	afterAll(async () => {
		// Cleanup
		server.stop();

		// Delete test users
		await db.user.deleteMany({
			where: {
				OR: [
					//
					{ email: { contains: 'test' } },
					{ email: { contains: 'temp' } },
					{ email: { in: [adminUser.email, regularUser.email] } },
				],
			},
		});
	});

	describe('Admin Routes', () => {
		it('should allow admin to get all users', async () => {
			const response = await fetch(`${BASE_URL}/api/users`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(200);

			const res = await response.json();
			expect(res.status).toBe(true);

			const data = res.data;

			expect(data).toBeDefined();
			expect(data.list).toBeDefined();
			expect(Array.isArray(data.list)).toBe(true);

			// Check pagination
			expect(data.pagination).toBeDefined();
			expect(typeof data.pagination.total).toBe('number');

			// Check no passwords are exposed
			const hasPassword = data.list.find((x: { password: any }) => x.password);
			expect(hasPassword).toBeUndefined();

			expect(data.list.length).toBeGreaterThanOrEqual(2);
		});

		it('should not allow regular user to get all users', async () => {
			const response = await fetch(`${BASE_URL}/api/users`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(403);
		});

		it('should allow admin to delete a user', async () => {
			const tempUser = await userService.createUser({
				email: `temp-${Date.now()}`,
				password: 'temppass',
				name: 'Temp User',
			});

			const response = await fetch(`${BASE_URL}/api/users/${tempUser.id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(200);

			// Verify user was deleted
			const deletedUser = await db.user.findUnique({
				where: { id: tempUser.id },
			});

			expect(deletedUser).toBeNull();
		});

		it('should not allow regular user to delete a user', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${adminId}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(403);
		});
	});

	describe('Self or Admin Routes', () => {
		it('should allow admin to get any user', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			const data = res.data;

			expect(data?.password).toBeUndefined();
			expect(data.id).toBe(userId);
		});

		it('should allow user to get their own data', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			const data = res.data;
			expect(data.id).toBe(userId);
			expect(data?.password).toBeUndefined();
		});

		it("should not allow user to get another user's data", async () => {
			const response = await fetch(`${BASE_URL}/api/users/${adminId}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(403);
		});

		it('should allow admin to update any user', async () => {
			const newName = 'Updated User Name';

			const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${adminToken}`,
				},
				body: JSON.stringify({
					name: newName,
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			const data = res.data;
			expect(data.name).toBe(newName);
			expect(data?.password).toBeUndefined();
		});

		it('should allow user to update their own data', async () => {
			const newName = 'Self Updated Name';

			const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify({
					name: newName,
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			const data = res.data;
			expect(data.name).toBe(newName);
			expect(data?.password).toBeUndefined();
		});

		it("should not allow user to update another user's data", async () => {
			const response = await fetch(`${BASE_URL}/api/users/${adminId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify({
					name: 'Hacker Attempt',
				}),
			});

			expect(response.status).toBe(403);
		});
	});

	describe('Profile Routes', () => {
		it('should allow user to get their profile', async () => {
			const response = await fetch(`${BASE_URL}/api/profile`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			const data = res.data;
			expect(data.id).toBe(userId);
			expect(data.password).toBeUndefined();
		});

		it('should allow user to update their profile', async () => {
			const newProfile = {
				name: 'New Profile Name',
			};

			const response = await fetch(`${BASE_URL}/api/profile`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify(newProfile),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			const data = res.data;

			expect(data.name).toBe(newProfile.name);
			expect(data.password).toBeUndefined();
		});

		it('should allow user to change their password', async () => {
			const passwordData = {
				currentPassword: regularUser.password,
				newPassword: 'NewPass456!',
			};

			const response = await fetch(`${BASE_URL}/api/profile/change-password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify(passwordData),
			});

			const res = await response.json();
			expect(response.status).toBe(200);
			expect(res?.data?.password).toBeUndefined();

			// Verify new password works by logging in
			const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: regularUser.email,
					password: passwordData.newPassword,
				}),
			});

			const resData = await loginRes.json();

			expect(loginRes.status).toBe(200);
			expect(resData?.data?.password).toBeUndefined();
		});

		it('should reject incorrect current password', async () => {
			const passwordData = {
				currentPassword: 'WrongPassword',
				newPassword: 'NewPass789!',
			};

			const response = await fetch(`${BASE_URL}/api/profile/change-password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify(passwordData),
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Authentication Requirements', () => {
		it('should reject requests without authentication', async () => {
			const routes = [
				{ url: `/api/users`, method: 'GET' },
				{ url: `/api/users/${userId}`, method: 'GET' },
				{ url: `/api/profile`, method: 'GET' },
			];

			for (const route of routes) {
				const response = await fetch(`${BASE_URL}${route.url}`, {
					method: route.method,
				});

				expect(response.status).toBe(401);
			}
		});

		it('should reject requests with invalid token', async () => {
			const response = await fetch(`${BASE_URL}/api/profile`, {
				method: 'GET',
				headers: {
					Authorization: 'Bearer invalid-token',
				},
			});

			expect(response.status).toBe(401);
		});
	});

	describe('User Search API', () => {
		it('should search users with pagination', async () => {
			// Login as admin to get token
			const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: adminUser.email,
					password: adminUser.password,
				}),
			});

			const adminData = await adminLoginRes.json();
			const adminToken = adminData.data.session.accessToken;

			// Create test users with specific emails for search
			const searchPrefix = `temp-test-search`;
			const testUsers = [
				{ email: `${searchPrefix}-user1`, password: 'Password123', name: 'Test User 1' },
				{ email: `${searchPrefix}-user2`, password: 'Password123', name: 'Test User 2' },
				{ email: `${searchPrefix}-user3`, password: 'Password123', name: 'Test User 3' },
			];

			// Create test users
			for (const user of testUsers) {
				await userService.createUser(user);
			}

			// Test search
			const searchResponse = await fetch(`${BASE_URL}/api/users/search?q=${searchPrefix}&page=1&limit=2`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});
			expect(searchResponse.status).toBe(200);

			const searchResult = await searchResponse.json();
			expect(searchResult.status).toBe(true);

			const data = searchResult.data;
			expect(data).toBeDefined();
			expect(data.list).toBeDefined();
			expect(Array.isArray(data.list)).toBe(true);

			// Check pagination
			expect(data.pagination).toBeDefined();
			expect(data.pagination.total).toBeGreaterThanOrEqual(3);
			expect(data.pagination.page).toBe(1);
			expect(data.pagination.limit).toBe(2);
			expect(data.pagination.pages).toBeGreaterThanOrEqual(2);

			// Check result contains only 2 items due to pagination limit
			expect(data.list.length).toBe(2);

			// Check search actually filtered results
			const allMatch = data.list.every((user: { email: string | string[] }) => user.email.includes(searchPrefix));

			expect(allMatch).toBe(true);

			// Check next page
			const page2Response = await fetch(`${BASE_URL}/api/users/search?q=${searchPrefix}&page=2&limit=2`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			const page2Result = await page2Response.json();
			const page2Data = page2Result.data;

			// Page 2 should have at least 1 result
			expect(page2Data.list.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Role Management', () => {
		it('should allow admin to change user role', async () => {
			// Get PRO role or create it if needed
			let proRole = await db.role.findUnique({ where: { name: AppRoleDefault.PRO } });
			if (!proRole) {
				proRole = await db.role.create({
					data: { name: AppRoleDefault.PRO },
				});
			}

			// Change user role to PRO
			const response = await fetch(`${BASE_URL}/api/users/${userId}/role`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${adminToken}`,
				},
				body: JSON.stringify({
					roleName: AppRoleDefault.PRO,
				}),
			});

			const result = await response.json();
			expect(response.status).toBe(200);
			expect(result.status).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.role.name).toBe(AppRoleDefault.PRO);

			// Verify role was changed in database
			const updatedUser = await db.user.findUnique({
				where: { id: userId },
				include: { role: true },
			});
			expect(updatedUser?.role.name).toBe(AppRoleDefault.PRO);
		});

		it('should not allow regular user to change roles', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userId}/role`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify({
					role: AppRoleDefault.ADMIN,
				}),
			});

			expect(response.status).toBe(403);
		});

		it('should validate role input', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userId}/role`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${adminToken}`,
				},
				body: JSON.stringify({
					role: 'invalid-role',
				}),
			});

			expect(response.status).toBe(400);
		});
	});
});
