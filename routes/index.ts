import { authRoutes } from '@/routes/authRoutes';
import { defaultRoutes } from '@/routes/defaultRoutes';
import { oauthCallbackRoutes } from '@/routes/oauthCallbackRoutes';
import { roleRoutes } from '@/routes/roleRoutes';
import { socialAuthRoutes } from '@/routes/socialAuthRoutes';
import { swaggerRoutes } from '@/routes/swaggerRoutes';
import { userRoutes } from '@/routes/userRoutes';
import type { Route } from '@/types/auth';

// Combine all routes
export const routes: Route[] = [
	//
	...defaultRoutes,
	...swaggerRoutes,
	...authRoutes,
	...userRoutes,
	...roleRoutes,
	...socialAuthRoutes,
	...oauthCallbackRoutes,
];
