// src/types/socialAuth.ts

export enum SocialProvider {
	GOOGLE = 'google',
	FACEBOOK = 'facebook',
	DISCORD = 'discord',
	GITHUB = 'github',
}

export interface SocialProfile {
	id: string;
	email: string;
	name?: string;
	provider: SocialProvider;
	providerId: string;
	providerData?: Record<string, any>;
}

export interface SocialAuthInput {
	provider: SocialProvider;
	accessToken: string;
	redirectUri?: string;
}

// Update to auth.ts
export interface SocialInput {
	provider: SocialProvider;
	accessToken: string;
	redirectUri?: string;
}
