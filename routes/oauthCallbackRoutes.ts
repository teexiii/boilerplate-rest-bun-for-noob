// src/routes/oauthCallbackRoutes.ts

import { oauthCallbackHandler } from '@/handlers/oauthCallbackHandler';
import { requireHash } from '@/middleware/security';
import type { Route } from '@/types/auth';

export const oauthCallbackRoutes: Route[] = [
	{
		path: '/api/auth/social/callback',
		method: 'POST',
		middleware: [requireHash],
		handler: oauthCallbackHandler.handleCallback,
	},
];
