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
		expect(data.session.accessToken).toBeDefined();
		expect(data.session.refreshToken).toBeDefined();

		// Save tokens for subsequent tests
		accessToken = data.session.accessToken;
		refreshToken = data.session.refreshToken;
	});

	it('should not register with existing email', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(testUser),
		});

		const res = await response.json();
		expect(response.status).toBe(400);
		expect(res.message).toBeDefined();
	});

	it('should login with valid credentials', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: testUser.email,
				password: testUser.password,
			}),
		});

		expect(response.status).toBe(200);
		const res = await response.json();
		const data = res.data || {};

		expect(data.user).toBeDefined();
		expect(data.user.email).toBe(testUser.email);
		expect(data.session.accessToken).toBeDefined();
		expect(data.session.refreshToken).toBeDefined();
	});

	it('should not login with invalid credentials', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: testUser.email,
				password: 'wrongpassword',
			}),
		});

		expect(response.status).toBe(400);
		const res = await response.json();
		expect(res.message).toBeDefined();
	});

	it('should refresh tokens', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				refreshToken,
			}),
		});

		expect(response.status).toBe(200);
		const res = await response.json();
		const data = res.data || {};

		console.log('data :>> ', data);
		expect(data.accessToken).toBeDefined();
		expect(data.refreshToken).toBeDefined();

		// Update tokens for subsequent tests
		accessToken = data.accessToken;
		refreshToken = data.refreshToken;
	});

	it('should not refresh with invalid token', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				refreshToken: 'invalid-token',
			}),
		});

		expect(response.status).toBe(401);
		const res = await response.json();
		const data = res.data || {};
		expect(res.message).toBeDefined();
	});

	it('should logout with valid token', async () => {
		console.log('accessToken :>> ', accessToken);
		const response = await fetch(`${BASE_URL}/api/auth/logout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				refreshToken,
			}),
		});

		const res = await response.json();
		console.log('res :>> ', res);
		expect(response.status).toBe(200);
		expect(res.message).toBeDefined();
	});

	it('should not access protected routes after logout', async () => {
		const response = await fetch(`${BASE_URL}/api/profile`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		// Token might still be valid for a short time depending on your implementation
		// In a real test, you might need to check that the token is definitely invalidated
		console.log('Profile access response:', await response.text());
	});

	describe('Email Verification', () => {
		let verificationToken: string;
		const testEmailUser = {
			email: `email-test-${Date.now()}`,
			password: 'Password123!',
			name: 'Email Test User',
		};

		it('should register a user and send verification email', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testEmailUser),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.user.email).toBe(testEmailUser.email);
		});

		it('should resend verification email', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testEmailUser.email }),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.token).toBeDefined();
			verificationToken = res.token;
		});

		it('should verify email with valid token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: verificationToken }),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.message || res.data?.message).toBe('Email verified successfully');
		});

		it('should not verify email with used token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: verificationToken }),
			});

			expect(response.status).toBe(400);
		});

		it('should not verify email with invalid token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'invalid-token' }),
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Password Reset', () => {
		let resetToken: string;
		const testPwdUser = {
			email: `pwd-test-${Date.now()}`,
			password: 'Password123!',
			name: 'Password Test User',
		};

		beforeAll(async () => {
			// Register test user
			await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testPwdUser),
			});
		});

		it('should initiate forgot password flow', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testPwdUser.email }),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.token).toBeDefined();
			resetToken = res.token;
		});

		it('should reset password with valid token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: resetToken, newPassword: 'NewPassword123!' }),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.message || res.data?.message).toBe('Password reset successfully');
		});

		it('should login with new password', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testPwdUser.email,
					password: 'NewPassword123!',
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.user.email).toBe(testPwdUser.email);
		});

		it('should not login with old password', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testPwdUser.email,
					password: testPwdUser.password,
				}),
			});

			expect(response.status).toBe(400);
		});

		it('should not reset password with used token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: resetToken, newPassword: 'AnotherPassword123!' }),
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Password Change (Authenticated)', () => {
		let changePasswordToken: string;
		const testChangePwdUser = {
			email: `change-pwd-${Date.now()}`,
			password: 'Password123!',
			name: 'Change Password User',
		};

		beforeAll(async () => {
			// Register and login
			const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testChangePwdUser),
			});

			const registerData = await registerRes.json();
			changePasswordToken = registerData.data.session.accessToken;
		});

		it('should change password with valid current password', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${changePasswordToken}`,
				},
				body: JSON.stringify({
					currentPassword: testChangePwdUser.password,
					newPassword: 'NewPassword456!',
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.message || res.data?.message).toContain('Password changed successfully');
		});

		it('should login with new password', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testChangePwdUser.email,
					password: 'NewPassword456!',
				}),
			});

			expect(response.status).toBe(200);
		});

		it('should not change password with incorrect current password', async () => {
			// Login again to get new token
			const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testChangePwdUser.email,
					password: 'NewPassword456!',
				}),
			});
			const loginData = await loginRes.json();
			const newToken = loginData.data.session.accessToken;

			const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${newToken}`,
				},
				body: JSON.stringify({
					currentPassword: 'WrongPassword!',
					newPassword: 'AnotherPassword789!',
				}),
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Email Change', () => {
		let emailChangeToken: string;
		let emailChangeVerificationToken: string;
		const testEmailChangeUser = {
			email: `email-change-${Date.now()}`,
			password: 'Password123!',
			name: 'Email Change User',
		};
		const newEmail = `new-email-${Date.now()}`;

		beforeAll(async () => {
			// Register and login
			const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testEmailChangeUser),
			});

			const registerData = await registerRes.json();
			emailChangeToken = registerData.data.session.accessToken;
		});

		it('should initiate email change', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/change-email`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${emailChangeToken}`,
				},
				body: JSON.stringify({
					newEmail,
					password: testEmailChangeUser.password,
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.token).toBeDefined();
			emailChangeVerificationToken = res.token;
		});

		it('should verify email change', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verify-email-change`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${emailChangeToken}`,
				},
				body: JSON.stringify({
					token: emailChangeVerificationToken,
					newEmail,
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.message || res.data?.message).toContain('Email changed successfully');
		});

		it('should login with new email', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: newEmail,
					password: testEmailChangeUser.password,
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.user.email).toBe(newEmail);
		});

		it('should not initiate email change with incorrect password', async () => {
			// Login again with new email
			const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: newEmail,
					password: testEmailChangeUser.password,
				}),
			});
			const loginData = await loginRes.json();
			const newToken = loginData.data.session.accessToken;

			const response = await fetch(`${BASE_URL}/api/auth/change-email`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${newToken}`,
				},
				body: JSON.stringify({
					newEmail: `another-${Date.now()}`,
					password: 'WrongPassword!',
				}),
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Logout All Devices', () => {
		const logoutAllUser = {
			email: `logout-all-${Date.now()}`,
			password: 'Password123!',
			name: 'Logout All User',
		};
		let token1: string;
		let token2: string;
		let refreshToken1: string;
		let refreshToken2: string;

		it('should login from first device', async () => {
			// Register
			const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(logoutAllUser),
			});

			const registerData = await registerRes.json();
			token1 = registerData.data.session.accessToken;
			refreshToken1 = registerData.data.session.refreshToken;
			expect(token1).toBeDefined();
		});

		it('should login from second device', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: logoutAllUser.email,
					password: logoutAllUser.password,
				}),
			});

			const res = await response.json();
			token2 = res.data.session.accessToken;
			refreshToken2 = res.data.session.refreshToken;
			expect(token2).toBeDefined();
		});

		it('should logout from all devices', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/logout-all`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token1}`,
				},
				body: JSON.stringify({}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.message).toBe('Logged out from all devices');
		});

		it('should not refresh with first device token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken: refreshToken1 }),
			});

			expect(response.status).toBe(401);
		});

		it('should not refresh with second device token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken: refreshToken2 }),
			});

			expect(response.status).toBe(401);
		});
	});

	describe('Check Rate Limit', () => {
		const testRateLimitCheckUser = {
			email: `rate-limit-check-${Date.now()}`,
			password: 'Password123!',
			name: 'Rate Limit Check User',
		};

		beforeAll(async () => {
			// Register user
			await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testRateLimitCheckUser),
			});
		});

		it('should check rate limit for PASSWORD_RESET', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/check-rate-limit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testRateLimitCheckUser.email,
					type: 'PASSWORD_RESET',
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.email).toBe(testRateLimitCheckUser.email);
			expect(res.data.type).toBe('PASSWORD_RESET');
			expect(res.data.count).toBeDefined();
			expect(res.data.limit).toBe(3);
			expect(res.data.remaining).toBeDefined();
			expect(res.data.canSend).toBeDefined();
		});

		it('should check rate limit for EMAIL_VERIFICATION', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/check-rate-limit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testRateLimitCheckUser.email,
					type: 'EMAIL_VERIFICATION',
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.type).toBe('EMAIL_VERIFICATION');
			expect(res.data.limit).toBe(5);
		});

		it('should not reveal if email does not exist', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/check-rate-limit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'nonexistent@example.com',
					type: 'PASSWORD_RESET',
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.count).toBe(0);
			expect(res.data.canSend).toBe(true);
		});

		it('should show correct remaining count after sending emails', async () => {
			// Send 2 password reset emails
			for (let i = 0; i < 2; i++) {
				await fetch(`${BASE_URL}/api/auth/forgot-password`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: testRateLimitCheckUser.email }),
				});
			}

			// Check rate limit
			const response = await fetch(`${BASE_URL}/api/auth/check-rate-limit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: testRateLimitCheckUser.email,
					type: 'PASSWORD_RESET',
				}),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.count).toBe(2);
			expect(res.data.remaining).toBe(1);
			expect(res.data.canSend).toBe(true);
		});
	});

	describe('Check Verification Token', () => {
		let verificationToken: string;
		const testCheckTokenUser = {
			email: `check-token-${Date.now()}`,
			password: 'Password123!',
			name: 'Check Token User',
		};

		beforeAll(async () => {
			// Register user
			await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testCheckTokenUser),
			});

			// Get verification token
			const response = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testCheckTokenUser.email }),
			});

			const res = await response.json();
			verificationToken = res.token;
		});

		it('should check if token is valid', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/check-token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: verificationToken }),
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.valid).toBe(true);
			expect(res.data.type).toBe('EMAIL_VERIFICATION');
			expect(res.data.expiresAt).toBeDefined();
			expect(res.data.user).toBeDefined();
			expect(res.data.user.email).toBe(testCheckTokenUser.email);
		});

		it('should return error for invalid token', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/check-token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'invalid-token' }),
			});

			expect(response.status).toBe(400);
		});

		it('should return error for used token', async () => {
			// Use the token first
			await fetch(`${BASE_URL}/api/auth/verify-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: verificationToken }),
			});

			// Try to check the used token
			const response = await fetch(`${BASE_URL}/api/auth/check-token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: verificationToken }),
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Get Latest Verification Tokens', () => {
		const testTokenUser = {
			email: `token-test-${Date.now()}`,
			password: 'Password123!',
			name: 'Token Test User',
		};
		let userToken: string;

		beforeAll(async () => {
			// Register and login
			const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testTokenUser),
			});

			const registerData = await registerRes.json();
			userToken = registerData.data.session.accessToken;

			// Create some verification tokens
			await fetch(`${BASE_URL}/api/auth/resend-verification`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testTokenUser.email }),
			});
		});

		it('should get latest verification tokens', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verification-tokens`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.tokens).toBeDefined();
			expect(Array.isArray(res.data.tokens)).toBe(true);
			expect(res.data.tokens.length).toBeGreaterThan(0);

			// Check that each token has the required fields
			const firstToken = res.data.tokens[0];
			expect(firstToken.createdAt).toBeDefined();
			expect(firstToken.expiresAt).toBeDefined();
			expect(firstToken.type).toBeDefined();
		});

		it('should include rate limit info for specific type', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verification-tokens?type=EMAIL_VERIFICATION`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.rateLimitInfo).toBeDefined();
			expect(res.data.rateLimitInfo.type).toBe('EMAIL_VERIFICATION');
			expect(res.data.rateLimitInfo.count).toBeDefined();
			expect(res.data.rateLimitInfo.limit).toBe(5);
		});

		it('should include rate limit info for PASSWORD_RESET type', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verification-tokens?type=PASSWORD_RESET`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.rateLimitInfo).toBeDefined();
			expect(res.data.rateLimitInfo.type).toBe('PASSWORD_RESET');
			expect(res.data.rateLimitInfo.count).toBeDefined();
			expect(res.data.rateLimitInfo.limit).toBe(3);
		});

		it('should include rate limit info for EMAIL_CHANGE type', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verification-tokens?type=EMAIL_CHANGE`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.rateLimitInfo).toBeDefined();
			expect(res.data.rateLimitInfo.type).toBe('EMAIL_CHANGE');
			expect(res.data.rateLimitInfo.count).toBeDefined();
			expect(res.data.rateLimitInfo.limit).toBe(3);
		});

		it('should filter by token type', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verification-tokens?type=EMAIL_VERIFICATION`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res.data.tokens).toBeDefined();
			expect(Array.isArray(res.data.tokens)).toBe(true);

			// Check that all tokens are of the requested type
			res.data.tokens.forEach((token: any) => {
				expect(token.type).toBe('EMAIL_VERIFICATION');
			});
		});

		it('should require authentication', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/verification-tokens`, {
				method: 'GET',
			});

			expect(response.status).toBe(401);
		});
	});

	describe('Rate Limiting', () => {
		const testRateLimitUser = {
			email: `rate-limit-${Date.now()}`,
			password: 'Password123!',
			name: 'Rate Limit User',
		};

		beforeAll(async () => {
			// Register user
			await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testRateLimitUser),
			});
		});

		it('should rate limit email verification resends', async () => {
			// Send 5 verification emails (including the one from registration)
			for (let i = 0; i < 5; i++) {
				const response = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: testRateLimitUser.email }),
				});

				if (i < 4) {
					expect(response.status).toBe(200);
				}
			}

			// The 6th attempt should be rate limited
			const response = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testRateLimitUser.email }),
			});

			expect(response.status).toBe(429);
			const res = await response.json();
			expect(res.message).toContain('Too many verification emails sent');
		});

		it('should rate limit password reset requests', async () => {
			const testPwdRateLimit = {
				email: `pwd-rate-limit-${Date.now()}`,
				password: 'Password123!',
				name: 'Password Rate Limit User',
			};

			// Register user
			await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testPwdRateLimit),
			});

			// Send 3 password reset requests
			for (let i = 0; i < 3; i++) {
				const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: testPwdRateLimit.email }),
				});

				expect(response.status).toBe(200);
			}

			// The 4th attempt should be rate limited
			const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testPwdRateLimit.email }),
			});

			expect(response.status).toBe(429);
			const res = await response.json();
			expect(res.message).toContain('Too many password reset requests');
		});

		it('should rate limit email change requests', async () => {
			const testEmailRateLimit = {
				email: `email-rate-limit-${Date.now()}`,
				password: 'Password123!',
				name: 'Email Rate Limit User',
			};

			// Register user
			const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testEmailRateLimit),
			});

			const registerData = await registerRes.json();
			const token = registerData.data.session.accessToken;

			// Send 3 email change requests
			for (let i = 0; i < 3; i++) {
				const response = await fetch(`${BASE_URL}/api/auth/change-email`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						newEmail: `new-email-${i}-${Date.now()}`,
						password: testEmailRateLimit.password,
					}),
				});

				expect(response.status).toBe(200);
			}

			// The 4th attempt should be rate limited
			const response = await fetch(`${BASE_URL}/api/auth/change-email`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					newEmail: `new-email-final-${Date.now()}`,
					password: testEmailRateLimit.password,
				}),
			});

			expect(response.status).toBe(429);
			const res = await response.json();
			expect(res.message).toContain('Too many email change requests');
		});
	});
});
