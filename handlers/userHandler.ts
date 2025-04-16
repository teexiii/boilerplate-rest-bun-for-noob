import { fail400, fail401, fail403, success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import { userService } from '@/services/userService';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import { toUserReponse } from '@/types/user';
import tokenCache from '@/caching/controller/token';
import { AppRoleDefault } from '@/data';

export const userHandler = {
	/**
	 * Admin Create User
	 */
	createUser: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const result = await userService.createUser(data);

			return success({
				data: {
					result,
				},
			});
		}),

	/**
	 * Get all users
	 */
	getAllUsers: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const url = new URL(req.url);
			const page = parseInt(url.searchParams.get('page') || '1');
			const limit = parseInt(url.searchParams.get('limit') || '50');
			const result = await userService.getAllUsers(page, limit);
			const list = result.list.map((x) => toUserReponse(x));

			return success({
				data: {
					...result,
					list,
				},
			});
		}),

	/**
	 * Get user by ID
	 */
	getUserById: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const user = await userService.getUserById(params.id);
			return success({ data: toUserReponse(user) });
		}),

	/**
	 * Update user
	 */
	updateUser: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const updatedUser = await userService.updateUser(params.id, data);
			return success({ data: toUserReponse(updatedUser) });
		}),

	/**
	 * Change password
	 */
	changePassword: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();

			if (!req.user) {
				return fail401('Authentication required');
			}

			await userService.changePassword(req.user.id, data);
			return success({ message: 'Password changed successfully' });
		}),

	/**
	 * Delete user
	 */
	deleteUser: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			await userService.deleteUser(params.id);

			return success({ message: 'User deleted successfully' });
		}),

	/**
	 * Get current user profile
	 */
	getProfile: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			// Get user from database
			const user = await userService.getUserById(req.user.id);

			await tokenCache.setByHeader(req.headers, {
				...req.user,
				...user,
			});

			return success({ data: toUserReponse(user) });
		}),

	/**
	 * Update current user profile
	 */
	updateProfile: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			if (!req.user) {
				return fail401('Authentication required');
			}

			const data = await req.json();
			const updatedUser = await userService.updateUser(req.user.id, data);
			await tokenCache.setByHeader(req.headers, {
				...req.user,
				...updatedUser,
			});

			return success({ data: toUserReponse(updatedUser) });
		}),

	/**
	 * Search users
	 */
	searchUsers: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const url = new URL(req.url);
			const query = url.searchParams.get('q') || '';
			const page = parseInt(url.searchParams.get('page') || '1');
			const limit = parseInt(url.searchParams.get('limit') || '50');

			const result = await userService.searchUsers(query, page, limit);
			const list = result.list.map((x) => toUserReponse(x));

			return success({
				data: {
					...result,
					list,
				},
			});
		}),

	/**
	 * Change user role
	 */
	changeUserRole: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const { roleName } = await req.json();

			if (!roleName) {
				return fail400('Role is required');
			}

			// Check if role exists
			const validRoles = Object.values(AppRoleDefault);
			if (!validRoles.includes(roleName)) {
				return fail400(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
			}

			const updatedUser = await userService.changeUserRole(params.id, roleName);
			return success({ data: updatedUser });
		}),
};
