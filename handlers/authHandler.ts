import { fail400, fail401, fail500, success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import { authService } from '@/services/authService';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import tokenCache from '@/caching/controller/token';

export const authHandler = {
	/**
	 * Register handler
	 */
	register: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.register(data);
			return success({ data: result });
		}),
	/**
	 * Login handler
	 */
	login: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.login(data);
			return success({ data: result });
		}),

	/**
	 * Admin Login handler
	 */
	adminLogin: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.login(data, true);
			return success({ data: result });
		}),

	/**
	 * Refresh token handler
	 */
	refreshToken: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.refreshToken(data);

			return success({ data: result });
		}),

	/**
	 * Logout handler
	 */
	logout: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			await authService.logout(data.refreshToken);

			await tokenCache.clearByHeader(req.headers);

			return success({ message: 'Logged out successfully' });
		}),

	/**
	 * Logout from all devices handler
	 */
	logoutAll: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			await authService.logoutAll(req.user.id);

			await tokenCache.clearByHeader(req.headers);

			return success({ message: 'Logged out from all devices' });
		}),
};
