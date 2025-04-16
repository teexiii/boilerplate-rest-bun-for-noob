import { success } from '@/lib/response';
import { errorHandler } from '@/middleware/error';
import { roleService } from '@/services/roleService';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';

export const roleHandler = {
	/**
	 * Get all roles
	 */
	getAllRoles: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const roles = await roleService.getAllRoles();
			return success({ data: roles });
		}),

	/**
	 * Get role by ID
	 */
	getRoleById: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const role = await roleService.getRoleById(params.id);
			return success({ data: role });
		}),

	/**
	 * Create role
	 */
	createRole: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const role = await roleService.createRole(data);
			return success({ data: role });
		}),

	/**
	 * Update role
	 */
	updateRole: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const data = await req.json();
			const role = await roleService.updateRole(params.id, data);
			return success({ data: role });
		}),

	/**
	 * Delete role
	 */
	deleteRole: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			await roleService.deleteRole(params.id);
			return success({ message: 'Role deleted successfully' });
		}),

	/**
	 * Get users with role
	 */
	getRoleUsers: async (req: AuthenticatedRequest, params: RouteParams) =>
		errorHandler(async () => {
			const users = await roleService.getRoleUsers(params.id);
			return success({ data: users });
		}),
};
