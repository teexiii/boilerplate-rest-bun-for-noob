import { authHandler } from '@/handlers/authHandler';
import { authenticate } from '@/middleware/auth';
import { requireHash } from '@/middleware/security';
import type { Route } from '@/types/auth';

export const authRoutes: Route[] = [
	// Registration and Login
	{
		path: '/api/auth/register',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.register,
	},
	{
		path: '/api/auth/login',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.login,
	},
	{
		path: '/api/auth/admin/login',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.adminLogin,
	},

	// Token Management
	{
		path: '/api/auth/refresh',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.refreshToken,
	},
	{
		path: '/api/auth/logout',
		method: 'POST',
		middleware: [authenticate],
		handler: authHandler.logout,
	},
	{
		path: '/api/auth/logout-all',
		method: 'POST',
		middleware: [authenticate],
		handler: authHandler.logoutAll,
	},

	// Email Verification
	{
		path: '/api/auth/verify-email',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.verifyEmail,
	},
	{
		path: '/api/auth/resend-verification',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.resendVerificationEmail,
	},
	{
		path: '/api/auth/verification-tokens',
		method: 'GET',
		middleware: [authenticate],
		handler: authHandler.getLatestVerificationTokens,
	},
	{
		path: '/api/auth/check-token',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.checkVerificationToken,
	},
	{
		path: '/api/auth/check-rate-limit',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.checkRateLimit,
	},

	// Password Management
	{
		path: '/api/auth/forgot-password',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.forgotPassword,
	},
	{
		path: '/api/auth/reset-password',
		method: 'POST',
		middleware: [requireHash],
		handler: authHandler.resetPassword,
	},
	{
		path: '/api/auth/change-password',
		method: 'POST',
		middleware: [authenticate],
		handler: authHandler.changePassword,
	},

	// Email Management
	{
		path: '/api/auth/change-email',
		method: 'POST',
		middleware: [authenticate],
		handler: authHandler.changeEmail,
	},
	{
		path: '/api/auth/verify-email-change',
		method: 'POST',
		middleware: [authenticate],
		handler: authHandler.verifyEmailChange,
	},
];
