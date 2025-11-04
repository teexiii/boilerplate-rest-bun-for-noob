// src/tests/integration/role.test.ts

import { AppRoleDefault } from '@/data';
import { hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/server/db';
import { generateAccessToken } from '@/lib/auth/jwt';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import { userService } from '@/services/userService';
import type { AuthenticatedRequest } from '@/types/auth';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

let server: any;
const TEST_PORT = 3089;
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

// Test role data
const testRoleName = `test-role-${Date.now()}`;
let testRoleId: string;

describe('Role API Integration Tests', () => {
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
			for (const roleName of [AppRoleDefault.VIEWER, AppRoleDefault.ADMIN, AppRoleDefault.PRO]) {
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

		try {
			server.stop();

			// Delete test users
			await db.user.deleteMany({
				where: {
					email: {
						in: [adminUser.email, regularUser.email],
					},
				},
			});

			await db.role.deleteMany({
				where: {
					OR: [
						//
						{ name: { contains: 'test' } },
						{ name: { contains: 'temp' } },
					],
				},
			});

			// Delete test role if it exists
			if (testRoleId) {
				try {
					await db.role.delete({
						where: { id: testRoleId },
					});
				} catch (error) {
					console.log('Error deleting test role:', error);
				}
			}
		} catch (error) {
			// throw new Error(`metname failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	});

	describe('Role Management', () => {
		it('should allow authenticated users to get all roles', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.status).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);

			// Should include default roles
			const roleNames = result.data.map((role: any) => role.name);
			expect(roleNames).toContain(AppRoleDefault.ADMIN);
			expect(roleNames).toContain(AppRoleDefault.VIEWER);
		});

		it('should allow admin to create a new role', async () => {
			const roleData = {
				name: testRoleName,
				description: 'Test role for integration testing',
			};

			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${adminToken}`,
				},
				body: JSON.stringify(roleData),
			});

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.status).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.name).toBe(testRoleName);

			// Save role ID for later tests
			testRoleId = result.data.id;
		});

		it('should not allow regular user to create a role', async () => {
			const roleData = {
				name: `${testRoleName}-2`,
				description: 'Another test role',
			};

			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${userToken}`,
				},
				body: JSON.stringify(roleData),
			});

			expect(response.status).toBe(403);
		});

		it('should allow admin to get role by ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/${testRoleId}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.status).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.id).toBe(testRoleId);
			expect(result.data.name).toBe(testRoleName);
		});

		it('should allow admin to update a role', async () => {
			const updateData = {
				description: 'Updated description',
			};

			const response = await fetch(`${BASE_URL}/api/roles/${testRoleId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${adminToken}`,
				},
				body: JSON.stringify(updateData),
			});

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.status).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.description).toBe(updateData.description);
		});

		it('should not allow updating default roles', async () => {
			const adminRole = await db.role.findUnique({ where: { name: AppRoleDefault.ADMIN } });

			const updateData = {
				description: 'Try to update admin role',
			};

			const response = await fetch(`${BASE_URL}/api/roles/${adminRole!.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${adminToken}`,
				},
				body: JSON.stringify(updateData),
			});

			expect(response.status).toBe(403);
		});

		it('should allow admin to get users with a specific role', async () => {
			const adminRole = await db.role.findUnique({ where: { name: AppRoleDefault.ADMIN } });

			const response = await fetch(`${BASE_URL}/api/roles/${adminRole!.id}/users`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.status).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);

			// Should include admin user
			const userIds = result.data.map((user: any) => user.id);
			expect(userIds).toContain(adminId);
		});

		it('should allow admin to delete a custom role', async () => {
			// First create a new role to delete
			const tempRole = await db.role.create({
				data: {
					name: `temp-role-${Date.now()}`,
					description: 'Temporary role for deletion test',
				},
			});

			const response = await fetch(`${BASE_URL}/api/roles/${tempRole.id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(200);

			// Verify role was deleted
			const deletedRole = await db.role.findUnique({
				where: { id: tempRole.id },
			});

			expect(deletedRole).toBeNull();
		});

		it('should not allow deleting a role with assigned users', async () => {
			const userRole = await db.role.findUnique({ where: { name: AppRoleDefault.VIEWER } });

			const response = await fetch(`${BASE_URL}/api/roles/${userRole!.id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(403);
		});

		it('should not allow deleting default roles', async () => {
			const adminRole = await db.role.findUnique({ where: { name: AppRoleDefault.ADMIN } });

			const response = await fetch(`${BASE_URL}/api/roles/${adminRole!.id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.status).toBe(403);
		});
	});
});
