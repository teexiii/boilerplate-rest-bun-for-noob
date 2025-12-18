// src/tests/socialAuth.test.ts

import { AppRoleDefault } from '@/data';
import { db } from '@/lib/server/db';
import { matchRoute } from '@/lib/utils/router';
import { routes } from '@/routes';
import { SocialProvider } from '@/types/socialAuth';
import type { AuthenticatedRequest } from '@/types/auth';
import { describe, it, expect, beforeAll, afterAll, beforeEach, mock, spyOn } from 'bun:test';
import * as socialFetch from '@/lib/auth/social/socialFetch';

let server: any;
const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Mock social profile data
const mockGoogleProfile = {
	id: '123456789',
	provider: SocialProvider.GOOGLE,
	providerId: '123456789',
	email: 'test@gmail.com',
	name: 'Test Google User',
	providerData: {
		email: 'test@gmail.com',
		email_verified: true,
		name: 'Test Google User',
		picture: 'https://example.com/picture.jpg',
	},
};

const mockFacebookProfile = {
	id: '987654321',
	provider: SocialProvider.FACEBOOK,
	providerId: '987654321',
	email: 'test@facebook.com',
	name: 'Test Facebook User',
	providerData: {
		email: 'test@facebook.com',
		name: 'Test Facebook User',
	},
};

// Test data
const testAccessToken = 'test-access-token';
const originalFetch = global.fetch;

describe('Social Auth API Integration Tests', () => {
	// Spy on fetchSocialProfile to mock provider API responses
	let fetchSocialProfileSpy: any;

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
				skipDuplicates: true,
			});
		} catch (error) {
			console.log('Roles already exist:', error);
		}

		// Create a spy for fetchSocialProfile
		fetchSocialProfileSpy = spyOn(socialFetch, 'fetchSocialProfile');
	});

	beforeEach(async () => {
		// Reset spy before each test
		fetchSocialProfileSpy.mockReset();

		// Clean up any social login test data from previous tests
		await db.social
			.deleteMany({
				where: {
					OR: [{ providerId: mockGoogleProfile.providerId }, { providerId: mockFacebookProfile.providerId }],
				},
			})
			.catch(console.error);

		await db.user
			.deleteMany({
				where: {
					OR: [
						{ email: { contains: 'google_' } },
						{ email: { contains: 'facebook_' } },
						{ email: { contains: mockGoogleProfile.email?.split('@')[0] || '' } },
						{ email: { contains: mockFacebookProfile.email?.split('@')[0] || '' } },
					],
				},
			})
			.catch(console.error);
	});

	afterAll(() => {
		// Cleanup
		server.stop();

		global.fetch = originalFetch;

		// Clean up all test data
		db.social
			.deleteMany({
				where: {
					OR: [{ providerId: mockGoogleProfile.providerId }, { providerId: mockFacebookProfile.providerId }],
				},
			})
			.catch(console.error);

		db.user
			.deleteMany({
				where: {
					OR: [
						{ email: { contains: 'google_' } },
						{ email: { contains: 'facebook_' } },
						{ email: { contains: mockGoogleProfile.email?.split('@')[0] || '' } },
						{ email: { contains: mockFacebookProfile.email?.split('@')[0] || '' } },
					],
				},
			})
			.catch(console.error);
	});

	it('should register a new user with Google social login', async () => {
		// Mock the fetchSocialProfile response
		fetchSocialProfileSpy.mockResolvedValue(mockGoogleProfile);

		const response = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: testAccessToken,
			}),
		});

		expect(response.status).toBe(200);
		const res = await response.json();
		const data = res.data || {};

		// Verify the response contains expected user and tokens
		expect(data.user).toBeDefined();
		expect(data.user.name).toBe(mockGoogleProfile.name);
		expect(data.session.accessToken).toBeDefined();
		expect(data.session.refreshToken).toBeDefined();

		// Verify the social login was created in the database
		const socials = await db.social.findMany({
			where: {
				providerId: mockGoogleProfile.providerId,
				provider: SocialProvider.GOOGLE,
			},
		});

		expect(socials.length).toBe(1);
		expect(socials[0]?.email).toBe(mockGoogleProfile.email);
	});

	it('should register a new user with Facebook social login', async () => {
		// Mock the fetchSocialProfile response
		fetchSocialProfileSpy.mockResolvedValue(mockFacebookProfile);

		const response = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.FACEBOOK,
				accessToken: testAccessToken,
			}),
		});

		expect(response.status).toBe(200);
		const res = await response.json();
		const data = res.data || {};

		// Verify the response contains expected user and tokens
		expect(data.user).toBeDefined();
		expect(data.user.name).toBe(mockFacebookProfile.name);
		expect(data.session.accessToken).toBeDefined();
		expect(data.session.refreshToken).toBeDefined();

		// Save user and tokens for subsequent tests
		const userId = data.user.id;
		const accessToken = data.session.accessToken;

		// Verify the social login was created in the database
		const socials = await db.social.findMany({
			where: {
				providerId: mockFacebookProfile.providerId,
				provider: SocialProvider.FACEBOOK,
			},
		});

		expect(socials.length).toBe(1);
		expect(socials[0]?.email).toBe(mockFacebookProfile.email);

		// Test fetching the user's social logins
		const socialLoginsResponse = await fetch(`${BASE_URL}/api/users/${userId}/social-logins`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		expect(socialLoginsResponse.status).toBe(200);
		const socialLoginsData = await socialLoginsResponse.json();
		expect(socialLoginsData.data).toBeDefined();
		expect(socialLoginsData.data.length).toBe(1);
		expect(socialLoginsData.data[0]?.provider).toBe(SocialProvider.FACEBOOK);
	});

	it('should login existing user with social provider', async () => {
		// First, create a user with Google social login
		fetchSocialProfileSpy.mockResolvedValue(mockGoogleProfile);

		await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: testAccessToken,
			}),
		});

		// Now try to login again with the same profile
		fetchSocialProfileSpy.mockResolvedValue(mockGoogleProfile);

		const loginResponse = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: testAccessToken,
			}),
		});

		expect(loginResponse.status).toBe(200);
		const res = await loginResponse.json();

		// Verify tokens and user data returned
		expect(res.data.session.accessToken).toBeDefined();
		expect(res.data.session.refreshToken).toBeDefined();
		expect(res.data.user).toBeDefined();
		expect(res.data.user.name).toBe(mockGoogleProfile.name);

		// Confirm there's still only one social login entry in the database
		const socials = await db.social.findMany({
			where: {
				providerId: mockGoogleProfile.providerId,
				provider: SocialProvider.GOOGLE,
			},
		});

		expect(socials.length).toBe(1);
	});

	it('should link a social social to an existing user', async () => {
		// First register with Google
		fetchSocialProfileSpy.mockResolvedValue(mockGoogleProfile);

		const googleResponse = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: testAccessToken,
			}),
		});

		const googleData = await googleResponse.json();
		const userId = googleData.data.user.id;
		const accessToken = googleData.data.session.accessToken;

		// Now link a Facebook social
		fetchSocialProfileSpy.mockResolvedValue(mockFacebookProfile);

		const linkResponse = await fetch(`${BASE_URL}/api/auth/social/link`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				provider: SocialProvider.FACEBOOK,
				accessToken: testAccessToken,
			}),
		});

		expect(linkResponse.status).toBe(200);

		// Verify both social socials are linked to the user
		const socialLoginsResponse = await fetch(`${BASE_URL}/api/users/${userId}/social-logins`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		const socialLoginsData = await socialLoginsResponse.json();
		expect(socialLoginsData.data.length).toBe(2);

		// Verify the providers in the response
		const providers = socialLoginsData.data.map((login: any) => login.provider);
		expect(providers).toContain(SocialProvider.GOOGLE);
		expect(providers).toContain(SocialProvider.FACEBOOK);
	});

	it('should unlink a social social from a user with multiple providers', async () => {
		// First register with Google
		fetchSocialProfileSpy.mockResolvedValue(mockGoogleProfile);

		const googleResponse = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: testAccessToken,
			}),
		});

		const googleData = await googleResponse.json();
		const userId = googleData.data.user.id;
		const accessToken = googleData.data.session.accessToken;

		// Link a Facebook social
		fetchSocialProfileSpy.mockResolvedValue(mockFacebookProfile);

		await fetch(`${BASE_URL}/api/auth/social/link`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				provider: SocialProvider.FACEBOOK,
				accessToken: testAccessToken,
			}),
		});

		// Now unlink the Facebook social
		const unlinkResponse = await fetch(`${BASE_URL}/api/auth/social/unlink/${SocialProvider.FACEBOOK}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		expect(unlinkResponse.status).toBe(200);

		// Verify only Google is still linked
		const socialLoginsResponse = await fetch(`${BASE_URL}/api/users/${userId}/social-logins`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		const socialLoginsData = await socialLoginsResponse.json();
		expect(socialLoginsData.data.length).toBe(1);
		expect(socialLoginsData.data[0]?.provider).toBe(SocialProvider.GOOGLE);
	});

	it('should not allow unlinking the only social provider if user has no password', async () => {
		// Register with Google
		fetchSocialProfileSpy.mockResolvedValue(mockGoogleProfile);

		const googleResponse = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: testAccessToken,
			}),
		});

		const googleData = await googleResponse.json();
		const accessToken = googleData.data.session.accessToken;

		// Try to unlink the only social provider
		const unlinkResponse = await fetch(`${BASE_URL}/api/auth/social/unlink/${SocialProvider.GOOGLE}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		// Should fail with 400 error
		expect(unlinkResponse.status).toBe(400);
		const errorData = await unlinkResponse.json();
		expect(errorData.message).toContain('Cannot remove the only login method');
	});

	it('should handle invalid social provider', async () => {
		// Try login with an invalid provider
		const response = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: 'invalid-provider',
				accessToken: testAccessToken,
			}),
		});

		// const errorData = await response.json();
		expect(response.status).toBe(401);
		// expect(errorData.message).toContain("Unsupported social provider");
	});

	it('should handle social API errors', async () => {
		const response = await fetch(`${BASE_URL}/api/auth/social/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				provider: SocialProvider.GOOGLE,
				accessToken: `testAccessToken123`,
			}),
		});

		// const errorData = await response.json();
		expect(response.status).toBe(401);
	});
});
