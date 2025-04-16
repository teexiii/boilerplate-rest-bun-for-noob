// src/routes/socialAuthRoutes.ts

import { socialAuthHandler } from '@/handlers/socialAuthHandler';
import { authenticate, requireSelfOrAdmin } from '@/middleware/auth';
import type { Route } from '@/types/auth';

export const socialAuthRoutes: Route[] = [
	{
		path: '/api/auth/social/login',
		method: 'POST',
		handler: socialAuthHandler.social,
	},
	{
		path: '/api/auth/social/link',
		method: 'POST',
		middleware: [authenticate],
		handler: socialAuthHandler.linkSocialAccount,
	},
	{
		path: '/api/auth/social/unlink/:provider',
		method: 'DELETE',
		middleware: [authenticate],
		handler: socialAuthHandler.unlinkSocialAccount,
	},
	{
		path: '/api/users/:userId/social-logins',
		method: 'GET',
		middleware: [authenticate, requireSelfOrAdmin('userId')],
		handler: socialAuthHandler.getUserSocials,
	},
];
