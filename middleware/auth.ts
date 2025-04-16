import { fail400, fail401, fail403 } from '@/lib/response';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { userRepo } from '@/repositories/userRepo';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import tokenCache from '@/caching/controller/token';
import { AppRoleDefault } from '@/data';

export function getAccessTokenByHeader(headers: Headers) {
	//
	try {
		const authHeader = headers.get('authorization');
		if (!authHeader) {
			throw new Error('Authentication required', { cause: 401 });
		}

		const token = authHeader.split(' ')[1];
		if (!token) {
			throw new Error('Bearer token required', { cause: 401 });
		}

		return token;
	} catch (error) {
		throw new Error(`${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Authenticate user from JWT token with Redis caching
 */
export async function authenticate(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	try {
		const token = getAccessTokenByHeader(req.headers);

		const cachedUser = await tokenCache.get(token);
		if (cachedUser) {
			// Use cached user
			req.user = cachedUser;
			return null; // Continue to next middleware/handler
		}

		// Token not in cache, verify it
		const payload = await verifyAccessToken(token);

		// Get user from database
		const user = await userRepo.findById(payload.userId);

		if (!user) {
			return fail401('User not found');
		}

		// Attach user to request
		req.user = {
			...user,
			isAdmin: user?.role.name == AppRoleDefault.ADMIN,
		};

		await tokenCache.set(token, req.user);

		return null; // Continue to next middleware/handler
	} catch (error) {
		return fail401('Invalid token');
	}
}

/**
 * Check if user has admin role
 */
export async function requireAdmin(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	if (!req.user) {
		return fail401('Authentication required');
	}

	if (req.user.role.name !== AppRoleDefault.ADMIN) {
		return fail403('Access denied');
	}

	return null; // Continue to next middleware/handler
}

/**
 * Check if user has admin role
 */
export async function requireAdminOrPro(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	if (!req.user) {
		return fail401('Authentication required');
	}

	if (req.user.role.name == AppRoleDefault.VIEWER) {
		return fail403('Access denied');
	}

	return null; // Continue to next middleware/handler
}

/**
 * Check if user has specific roles
 */
export function requireRoles(allowedRoles: string[]) {
	return async function (req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
		if (!req.user) {
			return fail401('Authentication required');
		}

		if (!allowedRoles.includes(req.user.role.name)) {
			return fail403(`Required roles: ${allowedRoles.join(', ')}`);
		}

		return null; // Continue to next middleware/handler
	};
}

/**
 * Check if user is accessing their own resource
 */
export function requireSelfOrAdmin(paramName: string) {
	return async function (req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
		if (!req.user) {
			return fail401('Authentication required');
		}

		const resourceId = params[paramName];
		if (!resourceId) {
			return fail400(`Missing parameter: ${paramName}`);
		}

		if (req.user.id !== resourceId && req.user.role.name !== AppRoleDefault.ADMIN) {
			return fail403('Access denied');
		}

		return null; // Continue to next middleware/handler
	};
}
