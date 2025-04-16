import { AppRoleDefault } from '@/data';
import { roleRepo } from '@/repositories/roleRepo';
import type { RoleCreateInput, RoleUpdateInput } from '@/types/role';

export const roleService = {
	/**
	 * Get all roles
	 */
	async getAllRoles() {
		return roleRepo.findAll();
	},

	/**
	 * Get role by ID
	 */
	async getRoleById(id: string) {
		const role = await roleRepo.findById(id);
		if (!role) {
			throw new Error('Role not found', { cause: 404 });
		}
		return role;
	},
	/**
	 * Get role by name
	 */
	async getRoleByName(name: string) {
		const role = await roleRepo.findByName(name);
		if (!role) {
			throw new Error('Role not found', { cause: 404 });
		}
		return role;
	},

	/**
	 * Create role
	 */
	async createRole(data: RoleCreateInput) {
		// Check if role with same name already exists
		const existing = await roleRepo.findByName(data.name);
		if (existing) {
			throw new Error('Role with this name already exists', { cause: 409 });
		}
		return roleRepo.create(data);
	},

	/**
	 * Update role
	 */
	async updateRole(id: string, data: RoleUpdateInput) {
		// Check if role exists
		const role = await this.getRoleById(id);

		// Check if name is being updated and already exists
		if (data.name && data.name !== role.name) {
			const existing = await roleRepo.findByName(data.name);
			if (existing) {
				throw new Error('Role with this name already exists', { cause: 409 });
			}
		}

		// Don't allow updating default roles
		if (Object.values(AppRoleDefault).includes(role.name)) {
			throw new Error('Cannot modify default role', { cause: 403 });
		}

		return roleRepo.update(id, data);
	},

	/**
	 * Delete role
	 */
	async deleteRole(id: string) {
		// Check if role exists
		const role = await this.getRoleById(id);

		// Don't allow deleting default roles
		if (Object.values(AppRoleDefault).includes(role.name)) {
			throw new Error('Cannot delete default role', { cause: 403 });
		}

		// Check if role has users
		const userCount = await roleRepo.countUsers(id);
		if (userCount > 0) {
			throw new Error(`Cannot delete role with assigned users (${userCount})`, { cause: 403 });
		}

		return roleRepo.delete(id);
	},

	/**
	 * Get users with role
	 */
	async getRoleUsers(id: string) {
		// Check if role exists
		await this.getRoleById(id);
		return roleRepo.getUsers(id);
	},

	/**
	 * Initialize default roles
	 */
	async initDefaultRoles() {
		return roleRepo.ensureDefaultRoles(Object.values(AppRoleDefault));
	},
};
