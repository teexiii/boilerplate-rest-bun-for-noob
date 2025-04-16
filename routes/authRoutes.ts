import { authHandler } from '@/handlers/authHandler';
import { authenticate } from '@/middleware/auth';
import type { Route } from '@/types/auth';

export const authRoutes: Route[] = [
	{
		path: '/api/auth/register',
		method: 'POST',
		handler: authHandler.register,
	},
	{
		path: '/api/auth/login',
		method: 'POST',
		handler: authHandler.login,
	},
	{
		path: '/api/auth/admin/login',
		method: 'POST',
		handler: authHandler.adminLogin,
	},
	{
		path: '/api/auth/refresh',
		method: 'POST',
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
];
