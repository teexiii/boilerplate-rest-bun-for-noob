import { fail400, fail401, fail500, success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import { authService } from '@/services/authService';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import { userCache } from '@/caching/userCache';

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

			// Clear user cache if authenticated
			if (req.user) {
				await userCache.clear(req.user.id, req.user.email);
			}

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

			// Clear user cache
			await userCache.clear(req.user.id, req.user.email);

			return success({ message: 'Logged out from all devices' });
		}),

	/**
	 * Verify email handler
	 */
	verifyEmail: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.verifyEmail(data);
			return success(result);
		}),

	/**
	 * Resend verification email handler
	 */
	resendVerificationEmail: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.resendVerificationEmail(data);
			return success(result);
		}),

	/**
	 * Forgot password handler
	 */
	forgotPassword: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.forgotPassword(data);
			return success(result);
		}),

	/**
	 * Reset password handler
	 */
	resetPassword: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.resetPassword(data);
			return success(result);
		}),

	/**
	 * Change password handler (authenticated)
	 */
	changePassword: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const data = await req.json();
			const result = await authService.changePassword(req.user.id, data);
			return success(result);
		}),

	/**
	 * Change email handler (authenticated)
	 */
	changeEmail: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const data = await req.json();
			const result = await authService.changeEmail(req.user.id, data);
			return success(result);
		}),

	/**
	 * Verify email change handler (authenticated)
	 */
	verifyEmailChange: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const data = await req.json();
			// Extract newEmail from the request body
			const { newEmail, ...tokenData } = data;
			const result = await authService.verifyEmailChange(req.user.id, newEmail, tokenData);
			return success(result);
		}),

	/**
	 * Get latest verification tokens handler (authenticated)
	 */
	getLatestVerificationTokens: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			// Get optional type from query parameters
			const url = new URL(req.url);
			const type = url.searchParams.get('type') as 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'EMAIL_CHANGE' | null;

			const result = await authService.getLatestVerificationTokens(req.user.id, type || undefined);
			return success({ data: result });
		}),

	/**
	 * Check verification token validity handler
	 */
	checkVerificationToken: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.checkVerificationToken(data.token);
			return success({ data: result });
		}),

	/**
	 * Check rate limit for email sending handler
	 */
	checkRateLimit: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await authService.checkRateLimit(data.email, data.type);
			return success({ data: result });
		}),
};
