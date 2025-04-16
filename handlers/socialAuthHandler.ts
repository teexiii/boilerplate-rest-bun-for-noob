// src/handlers/socialAuthHandler.ts

import { fail400, fail401, fail403, success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import { authenticate, requireSelfOrAdmin } from '@/middleware/auth';
import { socialAuthService } from '@/services/socialAuthService';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import type { SocialAuthInput } from '@/types/socialAuth';
import tokenCache from '@/caching/controller/token';

export const socialAuthHandler = {
	/**
	 * Social login handler
	 */
	social: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = (await req.json()) as SocialAuthInput;

			if (!data.provider || !data.accessToken) {
				return fail400('Provider and accessToken are required');
			}
			const result = await socialAuthService.social(data);
			return success({ data: result });
		}),

	/**
	 * Link social social handler
	 */
	linkSocialAccount: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const data = (await req.json()) as SocialAuthInput;

			if (!data.provider || !data.accessToken) {
				return fail400('Provider and accessToken are required');
			}

			await socialAuthService.linkSocialAccount(req.user.id, data);
			return success({ message: `${data.provider} social linked successfully` });
		}),

	/**
	 * Unlink social social handler
	 */
	unlinkSocialAccount: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const { provider } = params;

			if (!provider) {
				return fail400('Provider is required');
			}

			await socialAuthService.unlinkSocialAccount(req.user.id, provider);
			return success({ message: `${provider} social unlinked successfully` });
		}),

	/**
	 * Get user social logins handler
	 */
	getUserSocials: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const { userId } = params;

			if (!userId) {
				return fail400('User ID is required');
			}

			// Check if user is requesting their own social logins or is an admin
			if (req.user.id !== userId && !req.user.isAdmin) {
				return fail403('Access denied');
			}

			const socials = await socialAuthService.getUserSocials(userId);
			return success({ data: socials });
		}),
};
