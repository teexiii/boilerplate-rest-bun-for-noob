import { AppRoleDefault } from '@/data';
import { checkCorrectPassword, hashPassword } from '@/lib/auth/password';
import { refreshTokenRepo } from '@/repositories/refreshTokenRepo';
import { roleRepo } from '@/repositories/roleRepo';
import { userRepo } from '@/repositories/userRepo';
import { roleService } from '@/services/roleService';
import type { UserUpdateInput, ChangePasswordInput, UserCreateInput } from '@/types/user';

export const userService = {
	/**
	 * Create user
	 */
	async createUser(data: Omit<UserCreateInput, 'roleId'>) {
		const role = await roleService.getRoleByName(AppRoleDefault.VIEWER);
		if (!role) throw new Error('Please Try Again Later', { cause: 400 });

		data.password = await hashPassword(data.password);

		const user = await userRepo.create({ ...data, roleId: role.id });
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}
		return user;
	},

	/**
	 * Create Admin
	 */
	async createAdmin(data: Omit<UserCreateInput, 'roleId'>) {
		const role = await roleService.getRoleByName(AppRoleDefault.ADMIN);
		if (!role) throw new Error('Please Try Again Later', { cause: 400 });

		data.password = await hashPassword(data.password);

		const user = await userRepo.create({ ...data, roleId: role.id });
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}
		return user;
	},

	async getUserInfoById(id: string) {
		const user = await userRepo.findById(id);
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}
		return user;
	},

	async getUserPublicById(id: string) {
		//TODO add public user
		const user = await userRepo.findById(id);
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}
		return user;
	},

	/**
	 * Get user by ID
	 */
	async getUserById(id: string) {
		const user = await userRepo.findById(id);
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}
		return user;
	},

	/**
	 * Get all users with pagination
	 */
	async getAllUsers(page = 1, limit = 50) {
		const offset = (page - 1) * limit;

		const [users, total] = await Promise.all([userRepo.findAll({ limit, offset }), userRepo.count()]);

		return {
			list: users,
			pagination: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit),
			},
		};
	},

	/**
	 * Update user
	 */
	async updateUser(id: string, data: UserUpdateInput) {
		// Check if email is already taken
		if (data.email) {
			const existingUser = await userRepo.findByEmail(data.email);
			if (existingUser && existingUser.id !== id) {
				throw new Error('Email already in use', { cause: 400 });
			}
		}

		return userRepo.update(id, data);
	},

	/**
	 * Change user password
	 */
	async changePassword(id: string, data: ChangePasswordInput) {
		const user = await userRepo.findById(id);
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}
		if (!user.password) {
			throw new Error('Not found passsword', { cause: 400 });
		}

		// Verify current password
		const validPassword = await checkCorrectPassword(user.password, data.currentPassword);
		if (!validPassword) {
			throw new Error('Current password is incorrect', { cause: 400 });
		}

		// Hash new password
		const hashedPassword = await hashPassword(data.newPassword);

		// Update password
		await userRepo.updatePassword(id, hashedPassword);

		// Revoke all refresh tokens (optional, for security)
		await refreshTokenRepo.revokeAllForUser(id);
	},

	/**
	 * Delete user
	 */
	async deleteUser(id: string) {
		// This will cascade delete refresh tokens due to the Prisma schema relation
		await userRepo.delete(id);
	},

	/**
	 * Get users by role
	 */
	async getUsersByRole(roleId: string) {
		return userRepo.findByRoleId(roleId);
	},

	// searchPublicUsers
	async searchPublicUsers(query: string, page = 1, limit = 30) {
		//TODO search public user
		const offset = (page - 1) * limit;

		const [users, total] = await Promise.all([
			//
			userRepo.search(query, { limit, offset }),
			userRepo.countByQuery(query),
		]);

		return {
			list: users,
			pagination: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit),
			},
		};
	},

	/**
	 * Search users by email
	 */
	async searchUsers(query: string, page = 1, limit = 30) {
		const offset = (page - 1) * limit;

		const [users, total] = await Promise.all([
			//
			userRepo.search(query, { limit, offset }),
			userRepo.countByQuery(query),
		]);

		return {
			list: users,
			pagination: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit),
			},
		};
	},

	/**
	 * Change user role
	 */
	async changeUserRole(userId: string, roleName: string) {
		// Find the user
		const user = await userRepo.findById(userId);
		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}

		// Find the role
		const role = await roleRepo.findByName(roleName);

		if (!role) {
			throw new Error(`Role ${roleName} not found`, { cause: 404 });
		}

		// Update user's role
		return userRepo.update(userId, { roleId: role.id });
	},
};
