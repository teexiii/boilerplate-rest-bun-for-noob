// // src/tests/oauthCallback.test.ts

// import { matchRoute } from '@/lib/utils/router';
// import { routes } from '@/routes';
// import { SocialProvider } from '@/types/socialAuth';
// import type { AuthenticatedRequest } from '@/types/auth';
// import { describe, it, expect, beforeAll, afterAll, beforeEach, mock, jest } from 'bun:test';
// import { socialAuthService } from '@/services/socialAuthService';

// let server: any;
// const TEST_PORT = 3100;
// const BASE_URL = `http://localhost:${TEST_PORT}`;

// // Test data
// const testAuthCode = 'test-auth-code';
// const mockAccessToken = 'mock-access-token';

// const originalFetchMock = socialAuthService.social;

// describe('OAuth Callback API Integration Tests', () => {
// 	// Mock for global fetch to simulate OAuth token exchange
// 	let originalFetch: any;
// 	let mockSocial: any;

// 	beforeAll(async () => {
// 		// Save original fetch
// 		originalFetch = global.fetch;

// 		// Setup test server
// 		server = Bun.serve({
// 			port: TEST_PORT,
// 			async fetch(req: Request) {
// 				const match = matchRoute(routes, req as AuthenticatedRequest);
// 				if (match) {
// 					const { route, params } = match;

// 					try {
// 						// Cast request to AuthenticatedRequest for middleware
// 						const authReq = req as AuthenticatedRequest;

// 						// Run middleware
// 						if (route.middleware && route.middleware.length > 0) {
// 							for (const middleware of route.middleware) {
// 								const result = await middleware(authReq, params);
// 								if (result) {
// 									// Middleware returned a response, so return it
// 									return result;
// 								}
// 							}
// 						}
// 						// Run route handler
// 						const next = await route.handler(authReq, params);
// 						const res = await next();

// 						return res;
// 					} catch (error) {
// 						console.error('Test server error:', error);
// 						return new Response(JSON.stringify({ error: 'Internal server error' }), {
// 							status: 500,
// 							headers: { 'Content-Type': 'application/json' },
// 						});
// 					}
// 				}

// 				return new Response(JSON.stringify({ error: 'Not found' }), {
// 					status: 404,
// 					headers: { 'Content-Type': 'application/json' },
// 				});
// 			},
// 		});

// 		// Mock the socialAuthService.social method
// 		mockSocial = mock(() => ({
// 			accessToken: 'test-access-token-oauth',
// 			refreshToken: 'test-refresh-token-oauth',
// 			user: {
// 				id: 'test-user-id',
// 				email: 'test-user',
// 				name: 'Test User',
// 				role: {
// 					id: 'test-role-id',
// 					name: 'viewer',
// 				},
// 			},
// 		}));

// 		socialAuthService.social = mockSocial;
// 	});

// 	beforeEach(() => {
// 		// Reset the mock
// 		mockSocial.mockClear();

// 		// Reset fetch mock for each test
// 		global.fetch = mock((url: string, options?: any) => {
// 			// Mock responses for token exchange endpoints
// 			if (
// 				url.includes('oauth2.googleapis.com/token') ||
// 				url.includes('graph.facebook.com') ||
// 				url.includes('discord.com/api/oauth2/token') ||
// 				url.includes('github.com/login/oauth/access_token')
// 			) {
// 				return Promise.resolve({
// 					ok: true,
// 					json: () => Promise.resolve({ access_token: mockAccessToken }),
// 					text: () => Promise.resolve(`access_token=${mockAccessToken}`),
// 					headers: {
// 						get: (name: string) => (name === 'content-type' ? 'application/json' : null),
// 					},
// 				});
// 			}

// 			// Pass through to original fetch for other requests
// 			return originalFetch(url, options);
// 		}) as any;
// 	});

// 	afterAll(() => {
// 		// Cleanup
// 		server.stop();

// 		// Restore original fetch
// 		global.fetch = originalFetch;
// 		socialAuthService.social = originalFetchMock;

// 		jest.clearAllMocks();
// 	});

// 	it('should handle Google OAuth callback', async () => {
// 		const response = await fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				code: testAuthCode,
// 				provider: SocialProvider.GOOGLE,
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		expect(response.status).toBe(200);
// 		const res = await response.json();

// 		// Verify the response
// 		expect(res.data).toBeDefined();
// 		expect(res.data.session.accessToken).toBe('test-access-token-oauth');
// 		expect(res.data.session.refreshToken).toBe('test-refresh-token-oauth');

// 		// Verify socialAuthService.social was called with the right params
// 		expect(mockSocial).toHaveBeenCalledTimes(1);
// 		const callArgs = mockSocial.mock.calls[0]?.[0];
// 		expect(callArgs.provider).toBe(SocialProvider.GOOGLE);
// 		expect(callArgs.accessToken).toBe(mockAccessToken);
// 	});

// 	it('should handle Facebook OAuth callback', async () => {
// 		const response = await fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				code: testAuthCode,
// 				provider: SocialProvider.FACEBOOK,
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		expect(response.status).toBe(200);
// 		const res = await response.json();

// 		// Verify the response
// 		expect(res.data).toBeDefined();
// 		expect(res.data.session.accessToken).toBe('test-access-token-oauth');

// 		// Verify socialAuthService.social was called with the right params
// 		expect(mockSocial).toHaveBeenCalledTimes(1);
// 		const callArgs = mockSocial.mock.calls[0]?.[0];
// 		expect(callArgs.provider).toBe(SocialProvider.FACEBOOK);
// 		expect(callArgs.accessToken).toBe(mockAccessToken);
// 	});

// 	it('should handle Discord OAuth callback', async () => {
// 		const response = await fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				code: testAuthCode,
// 				provider: SocialProvider.DISCORD,
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		expect(response.status).toBe(200);

// 		// Verify socialAuthService.social was called with the right params
// 		expect(mockSocial).toHaveBeenCalledTimes(1);
// 		const callArgs = mockSocial.mock.calls[0]?.[0];
// 		expect(callArgs.provider).toBe(SocialProvider.DISCORD);
// 	});

// 	it('should handle GitHub OAuth callback', async () => {
// 		const response = await fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				code: testAuthCode,
// 				provider: SocialProvider.GITHUB,
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		expect(response.status).toBe(200);

// 		// Verify socialAuthService.social was called with the right params
// 		expect(mockSocial).toHaveBeenCalledTimes(1);
// 		const callArgs = mockSocial.mock.calls[0]?.[0];
// 		expect(callArgs.provider).toBe(SocialProvider.GITHUB);
// 	});

// 	it('should handle missing code or provider', async () => {
// 		const response = await fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				// Missing code
// 				provider: SocialProvider.GOOGLE,
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		expect(response.status).toBe(400);
// 		const res = await response.json();
// 		expect(res.message).toContain('Code and provider are required');

// 		// Verify socialAuthService.social was not called
// 		expect(mockSocial).not.toHaveBeenCalled();
// 	});

// 	it('should handle unsupported provider', async () => {
// 		const response = await fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				code: testAuthCode,
// 				provider: 'unsupported-provider',
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		expect(response.status).toBe(400);
// 		const res = await response.json();
// 		expect(res.message).toContain('Unsupported provider');

// 		// Verify socialAuthService.social was not called
// 		expect(mockSocial).not.toHaveBeenCalled();
// 	});

// 	it('should handle token exchange errors', async () => {
// 		// Mock a failed token exchange
// 		global.fetch = mock((url: string, options) => {
// 			if (
// 				url.includes('oauth2.googleapis.com/token') ||
// 				url.includes('graph.facebook.com') ||
// 				url.includes('discord.com/api/oauth2/token') ||
// 				url.includes('github.com/login/oauth/access_token')
// 			) {
// 				return Promise.resolve({
// 					ok: false,
// 					status: 400,
// 					text: () => Promise.resolve('Invalid grant'),
// 				});
// 			}
// 			return originalFetch(url, options);
// 		}) as any;

// 		const response = await global.fetch(`${BASE_URL}/api/auth/social/callback`, {
// 			method: 'POST',
// 			headers: { 'Content-Type': 'application/json' },
// 			body: JSON.stringify({
// 				code: testAuthCode,
// 				provider: SocialProvider.GOOGLE,
// 				state: btoa(JSON.stringify({ nonce: 'test-nonce' })),
// 			}),
// 		});

// 		const res = await response.json();
// 		expect(response.status).toBe(401);
// 		expect(res.message).toContain('Failed to exchange authorization code');

// 		// Verify socialAuthService.social was not called
// 		expect(mockSocial).not.toHaveBeenCalled();
// 	});
// });
