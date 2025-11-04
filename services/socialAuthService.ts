// src/services/socialAuthService.ts

import { AppRoleDefault } from '@/data';
import { db } from '@/lib/server/db';
import { fetchSocialProfile } from '@/lib/auth/social/socialFetch';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';
import { refreshTokenRepo } from '@/repositories/refreshTokenRepo';
import { userRepo } from '@/repositories/userRepo';
import { roleService } from '@/services/roleService';
import type { AuthResponse } from '@/types/auth';
import type { SocialAuthInput, SocialProfile } from '@/types/socialAuth';
import { toUserReponse, type UserSocials } from '@/types/user';
import { randomUUIDv7 } from 'bun';
import { refreshTokenService } from '@/services/refreshTokenService';

export const socialAuthService = {
	/**
	 * Login or register with social provider
	 */
	async social(input: SocialAuthInput): Promise<AuthResponse> {
		// Fetch profile from social provider
		const socialProfile = await fetchSocialProfile(input.provider, input.accessToken, input.redirectUri);
		if (!socialProfile?.providerId) throw new Error('Unsupported social provider', { cause: 401 });

		// Find existing user by provider and providerId
		let user = await db.user.findFirst({
			where: {
				socials: {
					some: {
						provider: input.provider,
						providerId: socialProfile?.providerId,
					},
				},
			},
			include: {
				role: true,
				socials: true,
			},
		});

		// If user doesn't exist but we have an email, check if email is already registered
		if (!user && socialProfile.email) {
			user = (await userRepo.findByEmail(socialProfile.email)) as any;
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
			const email = socialProfile.email;

			// Create the user
			user = await db.user.create({
				data: {
					email,
					password: '', // No password for social login users
					name: socialProfile.name || baseUsername,
					roleId: defaultRole.id,
					emailVerified: true,
					emailVerifiedAt: new Date(),
					socials: {
						create: {
							provider: input.provider,
							providerId: socialProfile.providerId,
							email: socialProfile.email,
							profileData: socialProfile.providerData || {},
						},
					},
				},
				include: {
					role: true,
					socials: true,
				},
			});
		} else if (
			!user.socials?.some((sl) => sl.provider === input.provider && sl.providerId === socialProfile.providerId)
		) {
			// User exists but doesn't have this social login connected - connect it
			await db.social.create({
				data: {
					userId: user.id,
					provider: input.provider,
					providerId: socialProfile.providerId,
					email: socialProfile.email,
					profileData: socialProfile.providerData || {},
				},
			});
		}

		if (!user?.emailVerified)
			await db.user.update({
				where: { id: user.id },
				data: {
					emailVerified: true,
					emailVerifiedAt: new Date(),
				},
			});

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
		const socialProfile = await fetchSocialProfile(input.provider, input.accessToken, input.redirectUri);

		// Check if this social social is already linked to another user
		const existingLink = await db.social.findFirst({
			where: {
				provider: input.provider,
				providerId: socialProfile.providerId,
			},
		});

		if (existingLink && existingLink.userId !== userId) {
			throw new Error('This social social is already linked to another user', { cause: 400 });
		}

		// If this social isn't linked to this user yet, create the link
		if (!existingLink) {
			await db.social.create({
				data: {
					userId,
					provider: input.provider,
					providerId: socialProfile.providerId,
					email: socialProfile.email,
					profileData: socialProfile.providerData || {},
				},
			});
		}
	},

	/**
	 * Unlink a social social from a user
	 */
	async unlinkSocialAccount(userId: string, provider: string): Promise<void> {
		// Count user's social logins
		const socialLoginCount = await db.social.count({
			where: { userId },
		});

		// Check if user has a password
		const user = await db.user.findUnique({
			where: { id: userId },
			select: { password: true },
		});

		// If user has no password and this is their only social login, prevent unlinking
		if (socialLoginCount <= 1 && (!user?.password || user.password === '')) {
			throw new Error('Cannot remove the only login method. Please set a password first.', { cause: 400 });
		}

		// Delete the social login
		await db.social.deleteMany({
			where: {
				userId,
				provider,
			},
		});
	},

	/**
	 * Get all social logins for a user
	 */
	async getUserSocials(userId: string): Promise<{ provider: string; email?: string | null }[]> {
		const socials = await db.social.findMany({
			where: { userId },
			select: {
				provider: true,
				email: true,
			},
		});

		return socials;
	},
};
