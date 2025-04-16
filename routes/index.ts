import { authRoutes } from '@/routes/authRoutes';
import { defaultRoutes } from '@/routes/defaultRoutes';
import { oauthCallbackRoutes } from '@/routes/oauthCallbackRoutes';
import { roleRoutes } from '@/routes/roleRoutes';
import { socialAuthRoutes } from '@/routes/socialAuthRoutes';
import { userRoutes } from '@/routes/userRoutes';
import type { Route } from '@/types/auth';

// Combine all routes
export const routes: Route[] = [
	//
	...defaultRoutes,
	...authRoutes,
	...userRoutes,
	...roleRoutes,
	...socialAuthRoutes,
	...oauthCallbackRoutes,
];
