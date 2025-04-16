// src/handlers/oauthCallbackHandler.ts

import { fail400, fail401, success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import { SocialProvider } from '@/types/socialAuth';
import { socialAuthService } from '@/services/socialAuthService';

// Configuration for OAuth providers
const oauthConfig = {
	[SocialProvider.GOOGLE]: {
		tokenUrl: 'https://oauth2.googleapis.com/token',
		clientId: process.env.GOOGLE_CLIENT_ID || '',
		clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
		redirectUri: `${process.env.APP_URL}/auth/callback/google`,
	},
	[SocialProvider.FACEBOOK]: {
		tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
		clientId: process.env.FACEBOOK_APP_ID || '',
		clientSecret: process.env.FACEBOOK_APP_SECRET || '',
		redirectUri: `${process.env.APP_URL}/auth/callback/facebook`,
	},
	[SocialProvider.DISCORD]: {
		tokenUrl: 'https://discord.com/api/oauth2/token',
		clientId: process.env.DISCORD_CLIENT_ID || '',
		clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
		redirectUri: `${process.env.APP_URL}/auth/callback/discord`,
	},
	[SocialProvider.GITHUB]: {
		tokenUrl: 'https://github.com/login/oauth/access_token',
		clientId: process.env.GITHUB_CLIENT_ID || '',
		clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
		redirectUri: `${process.env.APP_URL}/auth/callback/github`,
	},
};

export const oauthCallbackHandler = {
	/**
	 * Handle OAuth callback and exchange code for tokens
	 */
	handleCallback: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const { code, provider, state } = data;

			if (!code || !provider) {
				return fail400('Code and provider are required');
			}

			// Verify the provider is supported
			if (!Object.values(SocialProvider).includes(provider)) {
				return fail400(`Unsupported provider: ${provider}`);
			}

			// Get provider config
			const config = oauthConfig[provider as SocialProvider];
			if (!config) {
				return fail400(`Provider ${provider} not configured`);
			}

			try {
				// Exchange authorization code for access token
				const tokenResponse = await fetch(config.tokenUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						...(provider === SocialProvider.GITHUB
							? {
									Accept: 'application/json',
								}
							: {}),
					},
					body: new URLSearchParams({
						client_id: config.clientId,
						client_secret: config.clientSecret,
						code,
						redirect_uri: config.redirectUri,
						grant_type: 'authorization_code',
					}).toString(),
				});

				if (!tokenResponse.ok) {
					const errorData = await tokenResponse.text();
					console.error(`OAuth token exchange error: ${errorData}`);
					return fail401('Failed to exchange authorization code');
				}

				let tokenData;
				if (provider === SocialProvider.GITHUB) {
					tokenData = await tokenResponse.json();
				} else {
					// Parse response based on Content-Type
					const contentType = tokenResponse.headers.get('content-type');
					if (contentType?.includes('application/json')) {
						tokenData = await tokenResponse.json();
					} else {
						// Parse URL encoded response
						const text = await tokenResponse.text();
						tokenData = Object.fromEntries(new URLSearchParams(text));
					}
				}

				// Use the access token to login or register user
				const authResult = await socialAuthService.social({
					provider: provider as SocialProvider,
					accessToken: tokenData.access_token,
					redirectUri: config.redirectUri,
				});

				return success({ data: authResult });
			} catch (error) {
				console.error('OAuth callback error:', error);
				return fail401(error instanceof Error ? error.message : 'Authentication failed');
			}
		}),
};
