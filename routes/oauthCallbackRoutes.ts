// src/routes/oauthCallbackRoutes.ts

import { oauthCallbackHandler } from '@/handlers/oauthCallbackHandler';
import type { Route } from '@/types/auth';

export const oauthCallbackRoutes: Route[] = [
	{
		path: '/api/auth/social/callback',
		method: 'POST',
		handler: oauthCallbackHandler.handleCallback,
	},
];
