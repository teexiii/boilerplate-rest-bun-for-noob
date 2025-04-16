// src/services/frontendAuthService.ts

import { SocialProvider } from '@/types/socialAuth';

// Configuration for OAuth providers
const oauthConfig = {
	[SocialProvider.GOOGLE]: {
		clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
		redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/google`,
		authUrl: 'https://socials.google.com/o/oauth2/v2/auth',
		scope: 'openid email profile',
	},
	[SocialProvider.FACEBOOK]: {
		clientId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '',
		redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/facebook`,
		authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
		scope: 'email,public_profile',
	},
	[SocialProvider.DISCORD]: {
		clientId: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '',
		redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/discord`,
		authUrl: 'https://discord.com/api/oauth2/authorize',
		scope: 'identify email',
	},
	[SocialProvider.GITHUB]: {
		clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '',
		redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/github`,
		authUrl: 'https://github.com/login/oauth/authorize',
		scope: 'user:email',
	},
};

export const frontendAuthService = {
	/**
	 * Initialize OAuth flow for a provider
	 */
	initiateOAuthFlow(provider: SocialProvider): void {
		const config = oauthConfig[provider];

		if (!config) {
			throw new Error(`Provider ${provider} not configured`);
		}

		const params = new URLSearchParams({
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			response_type: 'code',
			scope: config.scope,
			state: this.generateState(provider),
		});

		window.location.href = `${config.authUrl}?${params.toString()}`;
	},

	/**
	 * Generate a secure state to prevent CSRF
	 */
	generateState(provider: SocialProvider): string {
		const state = {
			provider,
			nonce: Math.random().toString(36).substring(2, 15),
			timestamp: Date.now(),
		};

		// Store state in sessionStorage for verification
		sessionStorage.setItem('oauth_state', JSON.stringify(state));

		return btoa(JSON.stringify(state));
	},

	/**
	 * Verify returned state from OAuth provider
	 */
	verifyState(returnedState: string): boolean {
		try {
			const savedState = sessionStorage.getItem('oauth_state');
			if (!savedState) return false;

			const decodedState = JSON.parse(atob(returnedState));
			const savedStateObj = JSON.parse(savedState);

			// Verify nonce and check if state is not too old (10 minutes)
			const isValid =
				decodedState.nonce === savedStateObj.nonce &&
				decodedState.provider === savedStateObj.provider &&
				Date.now() - savedStateObj.timestamp < 10 * 60 * 1000;

			// Clear state
			sessionStorage.removeItem('oauth_state');

			return isValid;
		} catch (error) {
			console.error('Error verifying OAuth state:', error);
			return false;
		}
	},

	/**
	 * Exchange authorization code for tokens
	 */
	async handleOAuthCallback(code: string, provider: SocialProvider): Promise<any> {
		// This should be implemented on your backend to exchange the code for tokens
		// The frontend should send the code to your API
		const response = await fetch('/api/auth/social/callback', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code, provider }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to authenticate');
		}

		return response.json();
	},

	/**
	 * Login with a social access token
	 */
	async social(provider: SocialProvider, accessToken: string): Promise<any> {
		const response = await fetch('/api/auth/social/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ provider, accessToken }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to login');
		}

		return response.json();
	},

	/**
	 * Link a social social to the current user
	 */
	async linkSocialAccount(provider: SocialProvider, accessToken: string, authToken: string): Promise<any> {
		const response = await fetch('/api/auth/social/link', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authToken}`,
			},
			body: JSON.stringify({ provider, accessToken }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to link social');
		}

		return response.json();
	},

	/**
	 * Unlink a social social from the current user
	 */
	async unlinkSocialAccount(provider: SocialProvider, authToken: string): Promise<any> {
		const response = await fetch(`/api/auth/social/unlink/${provider}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authToken}`,
			},
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to unlink social');
		}

		return response.json();
	},

	/**
	 * Get user's social logins
	 */
	async getUserSocials(userId: string, authToken: string): Promise<any> {
		const response = await fetch(`/api/users/${userId}/social-logins`, {
			headers: { Authorization: `Bearer ${authToken}` },
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to get social logins');
		}

		return response.json();
	},
};
