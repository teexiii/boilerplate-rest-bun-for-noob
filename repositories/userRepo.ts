import { db } from '@/lib/server/db';
import type { UserWithRole, UserCreateInput, UserUpdateInput } from '@/types/user';
import type { Social } from '@prisma/client';

const include = {
	role: true,
	socials: true,
};

type IUser = UserWithRole & { socials?: Social[] };

const whereSearch = (query: string) => {
	return {
		OR: [
			{
				email: {
					contains: query,
					mode: 'insensitive' as any,
				},
			},
			{
				name: {
					contains: query,
					mode: 'insensitive' as any,
				},
			},
			{
				id: {
					contains: query,
					mode: 'insensitive' as any,
				},
			},
			{
				phone: {
					contains: query,
				},
			},
		],
	};
};

export const userRepo = {
	/**
	 * Find user by ID
	 */
	async findById(id: string) {
		return db.user.findUnique({
			where: { id },
			include,
		});
	},

	/**
	 * Find user by email
	 */
	async findByEmail(email: string) {
		return db.user.findUnique({
			where: { email },
			include,
		});
	},

	/**
	 * Search users by email
	 */
	async search(query: string, options?: { limit?: number; offset?: number }) {
		return db.user.findMany({
			where: whereSearch(query),
			include,
			take: options?.limit,
			skip: options?.offset,
			orderBy: { email: 'asc' },
		});
	},

	/**
	 * Count users matching email search
	 */
	async countByQuery(query: string) {
		return db.user.count({
			where: whereSearch(query),
		});
	},

	/**
	 * Get all users
	 */
	async findAll(options?: { limit?: number; offset?: number }) {
		return db.user.findMany({
			include,
			take: options?.limit,
			skip: options?.offset,
			orderBy: { email: 'asc' },
		});
	},

	/**
	 * Get all users
	 */
	async count() {
		return db.user.count({ where: {} });
	},

	/**
	 * Create a new user
	 */
	async create(data: UserCreateInput): Promise<IUser> {
		return db.user.create({
			data,
			include,
		});
	},

	/**
	 * Update a user
	 */
	async update(id: string, data: UserUpdateInput): Promise<IUser> {
		return db.user.update({
			where: { id },
			data,
			include,
		});
	},

	/**
	 * Update user password
	 */
	async updatePassword(id: string, password: string): Promise<IUser> {
		return db.user.update({
			where: { id },
			data: { password },
			include,
		});
	},

	/**
	 * Delete a user
	 */
	async delete(id: string): Promise<void> {
		await db.user.delete({
			where: { id },
		});
	},

	/**
	 * Count users with a specific role
	 */
	async countByRoleId(roleId: string): Promise<number> {
		return db.user.count({
			where: { roleId },
		});
	},

	/**
	 * Find users by role
	 */
	async findByRoleId(roleId: string, options?: { limit?: number; offset?: number }): Promise<IUser[]> {
		return db.user.findMany({
			where: { roleId },
			include,
			take: options?.limit,
			skip: options?.offset,
			orderBy: { email: 'asc' },
		});
	},
};
