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
	// UUID v7 regex pattern
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const isUuid = uuidRegex.test(query);

	const conditions: any[] = [
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
			phone: {
				contains: query,
			},
		},
	];

	// If query looks like a UUID, add exact match for id
	if (isUuid) {
		conditions.push({
			id: {
				equals: query,
			},
		});
	}

	return {
		OR: conditions,
	};
};

/**
 * Fetch user's socials by userId using raw SQL
 */
const fetchSocials = async (userId: string) => {
	return await db.$queryRaw<any[]>`
		SELECT
			id,
			created_at as "createdAt",
			updated_at as "updatedAt",
			provider,
			provider_id as "providerId",
			email,
			profile_data as "profileData",
			user_id as "userId"
		FROM socials
		WHERE user_id = ${userId}::uuid
	`;
};

/**
 * Fetch all socials for multiple users using raw SQL
 */
const fetchManySocials = async (userIds: string[]) => {
	if (userIds.length === 0) return [];

	return await db.$queryRaw<any[]>`
		SELECT
			id,
			created_at as "createdAt",
			updated_at as "updatedAt",
			provider,
			provider_id as "providerId",
			email,
			profile_data as "profileData",
			user_id as "userId"
		FROM socials
		WHERE user_id = ANY(${userIds}::uuid[])
	`;
};

/**
 * Map raw SQL row to user object with role and socials
 */
const mapRowToUser = (row: any, socials: any[]): IUser => {
	return {
		id: row.id,
		email: row.email,
		phone: row.phone,
		name: row.name,
		password: row.password,
		image: row.image,
		emailVerified: row.emailVerified,
		emailVerifiedAt: row.emailVerifiedAt,
		roleId: row.roleId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		role: {
			id: row['role.id'],
			name: row['role.name'],
			description: row['role.description'],
			createdAt: row['role.createdAt'],
			updatedAt: row['role.updatedAt'],
		},
		socials: socials,
	};
};

/**
 * Map multiple raw SQL rows to user objects with roles and socials
 */
const mapRowsToUsers = (rows: any[], allSocials: any[]): IUser[] => {
	// Group socials by userId for efficient lookup
	const socialsByUserId = allSocials.reduce(
		(acc, social) => {
			if (!acc[social.userId]) acc[social.userId] = [];
			acc[social.userId].push(social);
			return acc;
		},
		{} as Record<string, any[]>
	);

	return rows.map((row) => mapRowToUser(row, socialsByUserId[row.id] || []));
};

export const userRepo = {
	/**
	 * Find user by ID (with caching)
	 */
	async findById(id: string) {
		// Try cache first
		const cached = await userCache.getById(id);
		if (cached) return cached;

		// Fallback to database - using raw SQL
		const result = await db.$queryRaw<any[]>`
			SELECT
				u.id,
				u.email,
				u.phone,
				u.name,
				u.password,
				u.image,
				u.email_verified as "emailVerified",
				u.email_verified_at as "emailVerifiedAt",
				u.role_id as "roleId",
				u.created_at as "createdAt",
				u.updated_at as "updatedAt",
				r.id as "role.id",
				r.name as "role.name",
				r.description as "role.description",
				r.created_at as "role.createdAt",
				r.updated_at as "role.updatedAt"
			FROM users u
			INNER JOIN roles r ON u.role_id = r.id
			WHERE u.id = ${id}::uuid
		`;

		if (result.length === 0) return null;

		const socials = await fetchSocials(id);
		const user = mapRowToUser(result[0], socials);

		// Cache the result
		await userCache.setById(id, user);

		return user;
	},

	/**
	 * Find user by email (with caching)
	 */
	async findByEmail(email: string) {
		// Try cache first
		const cached = await userCache.getByEmail(email);
		if (cached) return cached;

		// Fallback to database - using raw SQL
		const result = await db.$queryRaw<any[]>`
			SELECT
				u.id,
				u.email,
				u.phone,
				u.name,
				u.password,
				u.image,
				u.email_verified as "emailVerified",
				u.email_verified_at as "emailVerifiedAt",
				u.role_id as "roleId",
				u.created_at as "createdAt",
				u.updated_at as "updatedAt",
				r.id as "role.id",
				r.name as "role.name",
				r.description as "role.description",
				r.created_at as "role.createdAt",
				r.updated_at as "role.updatedAt"
			FROM users u
			INNER JOIN roles r ON u.role_id = r.id
			WHERE u.email = ${email}
		`;

		if (result.length === 0) return null;

		const row = result[0];
		const socials = await fetchSocials(row.id);
		const user = mapRowToUser(row, socials);

		// Cache the result (cache by both email and ID)
		await Promise.all([userCache.setByEmail(email, user), userCache.setById(user.id, user)]);

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

		// Check if query is UUID for exact match
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		const isUuid = uuidRegex.test(query);

		// Fallback to database - using raw SQL with dynamic WHERE
		const likeQuery = `%${query}%`;
		const rows = isUuid
			? await db.$queryRaw<any[]>`
				SELECT
					u.id,
					u.email,
					u.phone,
					u.name,
					u.password,
					u.image,
					u.email_verified as "emailVerified",
					u.email_verified_at as "emailVerifiedAt",
					u.role_id as "roleId",
					u.created_at as "createdAt",
					u.updated_at as "updatedAt",
					r.id as "role.id",
					r.name as "role.name",
					r.description as "role.description",
					r.created_at as "role.createdAt",
					r.updated_at as "role.updatedAt"
				FROM users u
				INNER JOIN roles r ON u.role_id = r.id
				WHERE u.id = ${query}::uuid
				ORDER BY u.email ASC
				LIMIT ${options?.limit || 999999}
				OFFSET ${options?.offset || 0}
			`
			: await db.$queryRaw<any[]>`
				SELECT
					u.id,
					u.email,
					u.phone,
					u.name,
					u.password,
					u.image,
					u.email_verified as "emailVerified",
					u.email_verified_at as "emailVerifiedAt",
					u.role_id as "roleId",
					u.created_at as "createdAt",
					u.updated_at as "updatedAt",
					r.id as "role.id",
					r.name as "role.name",
					r.description as "role.description",
					r.created_at as "role.createdAt",
					r.updated_at as "role.updatedAt"
				FROM users u
				INNER JOIN roles r ON u.role_id = r.id
				WHERE (
					LOWER(u.email) LIKE LOWER(${likeQuery})
					OR LOWER(u.name) LIKE LOWER(${likeQuery})
					OR u.phone LIKE ${likeQuery}
				)
				ORDER BY u.email ASC
				LIMIT ${options?.limit || 999999}
				OFFSET ${options?.offset || 0}
			`;

		if (rows.length === 0) {
			await userCache.setList(cacheKey, []);
			return [];
		}

		const userIds = rows.map((row) => row.id);
		const allSocials = await fetchManySocials(userIds);
		const users = mapRowsToUsers(rows, allSocials);

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

		// Fallback to database - using raw SQL
		const rows = await db.$queryRaw<any[]>`
			SELECT
				u.id,
				u.email,
				u.phone,
				u.name,
				u.password,
				u.image,
				u.email_verified as "emailVerified",
				u.email_verified_at as "emailVerifiedAt",
				u.role_id as "roleId",
				u.created_at as "createdAt",
				u.updated_at as "updatedAt",
				r.id as "role.id",
				r.name as "role.name",
				r.description as "role.description",
				r.created_at as "role.createdAt",
				r.updated_at as "role.updatedAt"
			FROM users u
			INNER JOIN roles r ON u.role_id = r.id
			ORDER BY u.email ASC
			LIMIT ${options?.limit || 999999}
			OFFSET ${options?.offset || 0}
		`;

		if (rows.length === 0) {
			await userCache.setList(cacheKey, []);
			return [];
		}

		const userIds = rows.map((row) => row.id);
		const allSocials = await fetchManySocials(userIds);
		const users = mapRowsToUsers(rows, allSocials);

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
	async create(data: UserCreateInput) {
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
	async update(id: string, data: UserUpdateInput) {
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
	async updatePassword(id: string, password: string) {
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

		// Fallback to database - using raw SQL
		const rows = await db.$queryRaw<any[]>`
			SELECT
				u.id,
				u.email,
				u.phone,
				u.name,
				u.password,
				u.image,
				u.email_verified as "emailVerified",
				u.email_verified_at as "emailVerifiedAt",
				u.role_id as "roleId",
				u.created_at as "createdAt",
				u.updated_at as "updatedAt",
				r.id as "role.id",
				r.name as "role.name",
				r.description as "role.description",
				r.created_at as "role.createdAt",
				r.updated_at as "role.updatedAt"
			FROM users u
			INNER JOIN roles r ON u.role_id = r.id
			WHERE u.role_id = ${roleId}::uuid
			ORDER BY u.email ASC
			LIMIT ${options?.limit || 999999}
			OFFSET ${options?.offset || 0}
		`;

		if (rows.length === 0) {
			await userCache.setByRole(roleId, [], options);
			return [];
		}

		const userIds = rows.map((row) => row.id);
		const allSocials = await fetchManySocials(userIds);
		const users = mapRowsToUsers(rows, allSocials);

		// Cache the result
		await userCache.setByRole(roleId, users, options);

		return users;
	},

	/**
	 * Mark user email as verified
	 */
	async markEmailAsVerified(id: string) {
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
	async updateEmail(id: string, email: string) {
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
