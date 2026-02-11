import { AppRoleDefault } from '@/data';
import { fetchSocialProfile } from '@/lib/auth/social/socialFetch';
import { generateAccessToken } from '@/lib/auth/jwt';
import { userRepo } from '@/repositories/userRepo';
import { socialRepo } from '@/repositories/socialRepo';
import { roleService } from '@/services/roleService';
import type { AuthResponse } from '@/types/auth';
import type { SocialAuthInput, SocialProvider } from '@/types/socialAuth';
import { toUserReponse } from '@/types/user';
import { refreshTokenService } from '@/services/refreshTokenService';
import { v4 } from 'uuid';

export const socialAuthService = {
	/**
	 * Login or register with social provider
	 */
	async social(input: SocialAuthInput): Promise<AuthResponse> {
		// Fetch profile from social provider
		const socialProfile = await fetchSocialProfile(
			input.provider,
			input.accessToken,
			input.redirectUri,
			input.codeVerifier
		);
		if (!socialProfile?.providerId) throw new Error('Unsupported social provider', { cause: 401 });

		// Find existing user by provider and providerId
		let user = await socialRepo.findUserByProviderAndId(input.provider, socialProfile.providerId);

		// If user doesn't exist but we have an email, check if email is already registered
		if (!user && socialProfile.email) {
			user = await userRepo.findByEmail(socialProfile.email);
		}

		// If user doesn't exist, create a new one
		if (!user) {
			const defaultRole = await roleService.getRoleByName(AppRoleDefault.VIEWER);

			if (!defaultRole) {
				throw new Error('Default role not found');
			}

			// Generate unique email from provider and id
			const baseUsername =
				socialProfile.email?.split('@')[0] || `${input.provider}_${socialProfile.providerId.substring(0, 8)}`;

			// Make sure the email is unique
			const email = socialProfile?.email || `${baseUsername}-${v4()}@${input.provider}.com`;

			// Create the user with social login
			user = await userRepo.createWithSocial({
				email,
				name: socialProfile?.name || baseUsername,
				roleId: defaultRole.id,
				emailVerified: true,
				emailVerifiedAt: new Date(),
				social: {
					provider: input.provider,
					providerId: socialProfile?.providerId,
					email,
					profileData: socialProfile?.providerData || {},
				},
			});
		} else if (
			!user.socials?.some((sl) => sl.provider === input.provider && sl.providerId === socialProfile.providerId)
		) {
			// User exists but doesn't have this social login connected - connect it
			await socialRepo.create({
				userId: user.id,
				provider: input.provider,
				providerId: socialProfile.providerId,
				email: socialProfile.email,
				profileData: socialProfile.providerData || {},
			});
		}

		if (!user?.emailVerified) {
			await userRepo.markEmailAsVerified(user!.id);
			user = await userRepo.findById(user!.id);

			if (!user) throw new Error('User not found', { cause: 404 });
		}

		// Generate tokens
		const accessToken = await generateAccessToken(user);

		const refreshToken = await refreshTokenService.generateRefreshTokenByUser(user);

		return {
			session: { accessToken, refreshToken: refreshToken.token },
			user: toUserReponse(user),
		};
	},

	/**
	 * Link a social social to an existing user
	 */
	async linkSocialAccount(userId: string, input: SocialAuthInput): Promise<void> {
		// Fetch profile from social provider
		const socialProfile = await fetchSocialProfile(
			input.provider,
			input.accessToken,
			input.redirectUri,
			input.codeVerifier
		);

		// Check if this social social is already linked to another user
		const existingLink = await socialRepo.findByProviderAndId(input.provider, socialProfile.providerId);

		if (existingLink && existingLink.userId !== userId) {
			throw new Error('This social social is already linked to another user', { cause: 400 });
		}

		// If this social isn't linked to this user yet, create the link
		if (!existingLink) {
			await socialRepo.create({
				userId,
				provider: input.provider,
				providerId: socialProfile.providerId,
				email: socialProfile.email,
				profileData: socialProfile.providerData || {},
			});
		}
	},

	/**
	 * Unlink a social social from a user
	 */
	async unlinkSocialAccount(userId: string, provider: string): Promise<void> {
		// Count user's social logins
		const socialLoginCount = await socialRepo.countByUserId(userId);

		// Check if user has a password
		const user = await userRepo.findById(userId);
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}

		// If user has no password and this is their only social login, prevent unlinking
		if (socialLoginCount <= 1 && (!user?.password || user.password === '')) {
			throw new Error('Cannot remove the only login method. Please set a password first.', { cause: 400 });
		}

		// Delete the social login
		await socialRepo.deleteByUserIdAndProvider(userId, provider);
	},

	/**
	 * Get all social logins for a user
	 */
	async getUserSocials(userId: string): Promise<{ provider: string; email?: string | null }[]> {
		return socialRepo.findByUserId(userId);
	},
};
