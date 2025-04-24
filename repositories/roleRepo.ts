import { db } from '@/lib/server/db';
import type { RoleCreateInput, RoleUpdateInput } from '@/types/role';

export const roleRepo = {
	/**
	 * Find role by ID
	 */
	async findById(id: string) {
		return db.role.findUnique({
			where: { id },
		});
	},

	/**
	 * Find role by name
	 */
	async findByName(name: string) {
		return db.role.findUnique({
			where: { name },
		});
	},

	/**
	 * Get all roles
	 */
	async findAll() {
		return db.role.findMany({
			include: {
				_count: {
					select: { users: true },
				},
			},
			orderBy: { name: 'asc' },
		});
	},

	/**
	 * Create role
	 */
	async create(data: RoleCreateInput) {
		return db.role.create({
			data: {
				name: data.name,
				description: data.description,
			},
		});
	},

	/**
	 * Update role
	 */
	async update(id: string, data: RoleUpdateInput) {
		return db.role.update({
			where: { id },
			data,
		});
	},

	/**
	 * Delete role
	 */
	async delete(id: string) {
		return db.role.delete({
			where: { id },
		});
	},

	/**
	 * Get users with role
	 */
	async getUsers(roleId: string) {
		return db.user.findMany({
			where: { roleId },
			select: {
				id: true,
				email: true,
				name: true,
				createdAt: true,
			},
		});
	},

	/**
	 * Count users with role
	 */
	async countUsers(roleId: string) {
		return db.user.count({
			where: { roleId },
		});
	},

	/**
	 * Ensure default roles exist
	 */
	async ensureDefaultRoles(defaultRoles: string[]) {
		const operations = defaultRoles.map((roleName) =>
			db.role.upsert({
				where: { name: roleName },
				update: {},
				create: { name: roleName },
			})
		);

		return Promise.all(operations);
	},
};
