import { db } from '@/lib/server/db';
import { userCache } from '@/caching/userCache';
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
	 * Find user by ID (with caching)
	 */
	async findById(id: string) {
		// Try cache first
		const cached = await userCache.getById(id);
		if (cached) return cached;

		// Fallback to database
		const user = await db.user.findUnique({
			where: { id },
			include,
		});

		// Cache the result if found
		if (user) {
			await userCache.setById(id, user);
		}

		return user;
	},

	/**
	 * Find user by email (with caching)
	 */
	async findByEmail(email: string) {
		// Try cache first
		const cached = await userCache.getByEmail(email);
		if (cached) return cached;

		// Fallback to database
		const user = await db.user.findUnique({
			where: { email },
			include,
		});

		// Cache the result if found (cache by both email and ID)
		if (user) {
			await Promise.all([userCache.setByEmail(email, user), userCache.setById(user.id, user)]);
		}

		return user;
	},

	/**
	 * Search users by email (with caching)
	 */
	async search(query: string, options?: { limit?: number; offset?: number }) {
		// Generate stable cache key from query and options
		const cacheKey = `search:${query}:${options?.limit || 'all'}:${options?.offset || 0}`;

		// Try cache first
		const cached = await userCache.getList(cacheKey);
		if (cached) return cached;

		// Fallback to database
		const users = await db.user.findMany({
			where: whereSearch(query),
			include,
			take: options?.limit,
			skip: options?.offset,
			orderBy: { email: 'asc' },
		});

		// Cache the result
		await userCache.setList(cacheKey, users);

		return users;
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
	 * Get all users (with caching)
	 */
	async findAll(options?: { limit?: number; offset?: number }) {
		// Generate stable cache key from options
		const cacheKey = `all:${options?.limit || 'all'}:${options?.offset || 0}`;

		// Try cache first
		const cached = await userCache.getList(cacheKey);
		if (cached) return cached;

		// Fallback to database
		const users = await db.user.findMany({
			include,
			take: options?.limit,
			skip: options?.offset,
			orderBy: { email: 'asc' },
		});

		// Cache the result
		await userCache.setList(cacheKey, users);

		return users;
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
		const user = await db.user.create({
			data,
			include,
		});

		// Invalidate list caches since a new user was added
		await userCache.clearLists();

		return user;
	},

	/**
	 * Update a user
	 */
	async update(id: string, data: UserUpdateInput): Promise<IUser> {
		const user = await db.user.update({
			where: { id },
			data,
			include,
		});

		// Invalidate cache for this user and all lists
		await userCache.invalidate(id, user.email);

		return user;
	},

	/**
	 * Update user password
	 */
	async updatePassword(id: string, password: string): Promise<IUser> {
		const user = await db.user.update({
			where: { id },
			data: { password },
			include,
		});

		// Clear cache for this user (password change doesn't affect lists)
		await userCache.clear(id, user.email);

		return user;
	},

	/**
	 * Delete a user
	 */
	async delete(id: string): Promise<void> {
		// Get user first to access email
		const user = await db.user.findUnique({ where: { id }, select: { email: true } });

		await db.user.delete({
			where: { id },
		});

		// Invalidate cache for this user and all lists
		if (user) {
			await userCache.invalidate(id, user.email);
		}
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
	 * Find users by role (with caching)
	 */
	async findByRoleId(roleId: string, options?: { limit?: number; offset?: number }): Promise<IUser[]> {
		// Try cache first
		const cached = await userCache.getByRole(roleId, options);
		if (cached) return cached;

		// Fallback to database
		const users = await db.user.findMany({
			where: { roleId },
			include,
			take: options?.limit,
			skip: options?.offset,
			orderBy: { email: 'asc' },
		});

		// Cache the result
		await userCache.setByRole(roleId, users, options);

		return users;
	},

	/**
	 * Mark user email as verified
	 */
	async markEmailAsVerified(id: string): Promise<IUser> {
		const user = await db.user.update({
			where: { id },
			data: {
				emailVerified: true,
				emailVerifiedAt: new Date(),
			},
			include,
		});

		// Clear cache for this user (verification status change doesn't affect lists)
		await userCache.clear(id, user.email);

		return user;
	},

	/**
	 * Update user email
	 */
	async updateEmail(id: string, email: string): Promise<IUser> {
		// Get old email first to clear cache
		const oldUser = await db.user.findUnique({ where: { id }, select: { email: true } });

		const user = await db.user.update({
			where: { id },
			data: {
				email,
				emailVerified: false,
				emailVerifiedAt: null,
			},
			include,
		});

		// Clear cache for both old and new email, and all lists
		if (oldUser) {
			await Promise.all([
				userCache.clear(id, oldUser.email), // Clear old email cache
				userCache.clear(id, user.email), // Clear new email cache
				userCache.clearLists(), // Email change might affect search results
			]);
		}

		return user;
	},
};
