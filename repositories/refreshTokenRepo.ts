import { db } from '@/lib/server/db';
import { queueWrite } from '@/repositories/helper';

export const refreshTokenRepo = {
	/**
	 * Create a new refresh token
	 */
	async create(data: { id?: string; token: string; expiresAt: Date; userId: string }) {
		const refreshToken = await queueWrite(() =>
			db.refreshToken.create({
				data,
			})
		);

		return refreshToken;
	},

	/**
	 * Update token value
	 */
	async updateToken(id: string, token: string) {
		return queueWrite(() =>
			db.refreshToken.update({
				where: { id },
				data: { token },
			})
		);
	},

	/**
	 * Find refresh token by token string
	 */
	async findByToken(token: string) {
		const result = await db.$queryRaw<any[]>`
			SELECT
				rt.id,
				rt.token,
				rt.user_id as "userId",
				rt.expires_at as "expiresAt",
				rt.created_at as "createdAt",
				rt."isRevoked",
				u.id as "user.id",
				u.email as "user.email",
				u.phone as "user.phone",
				u.name as "user.name",
				u.image as "user.image",
				u.email_verified as "user.emailVerified",
				u.email_verified_at as "user.emailVerifiedAt",
				u.role_id as "user.roleId",
				u.created_at as "user.createdAt",
				u.updated_at as "user.updatedAt",
				r.id as "user.role.id",
				r.name as "user.role.name",
				r.description as "user.role.description",
				r.created_at as "user.role.createdAt",
				r.updated_at as "user.role.updatedAt"
			FROM refresh_tokens rt
			INNER JOIN users u ON rt.user_id = u.id
			INNER JOIN roles r ON u.role_id = r.id
			WHERE rt.token = ${token}
		`;

		if (result.length === 0) return null;

		const row = result[0];
		return {
			id: row.id,
			token: row.token,
			userId: row.userId,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			isRevoked: row.isRevoked,
			user: {
				id: row['user.id'],
				email: row['user.email'],
				phone: row['user.phone'],
				name: row['user.name'],
				image: row['user.image'],
				emailVerified: row['user.emailVerified'],
				emailVerifiedAt: row['user.emailVerifiedAt'],
				roleId: row['user.roleId'],
				createdAt: row['user.createdAt'],
				updatedAt: row['user.updatedAt'],
				role: {
					id: row['user.role.id'],
					name: row['user.role.name'],
					description: row['user.role.description'],
					createdAt: row['user.role.createdAt'],
					updatedAt: row['user.role.updatedAt'],
				},
			},
		};
	},

	/**
	 * Find refresh token by ID
	 */
	async findById(id: string) {
		const result = await db.$queryRaw<any[]>`
			SELECT
				rt.id,
				rt.token,
				rt.user_id as "userId",
				rt.expires_at as "expiresAt",
				rt.created_at as "createdAt",
				rt."isRevoked",
				u.id as "user.id",
				u.email as "user.email",
				u.phone as "user.phone",
				u.name as "user.name",
				u.image as "user.image",
				u.email_verified as "user.emailVerified",
				u.email_verified_at as "user.emailVerifiedAt",
				u.role_id as "user.roleId",
				u.created_at as "user.createdAt",
				u.updated_at as "user.updatedAt",
				r.id as "user.role.id",
				r.name as "user.role.name",
				r.description as "user.role.description",
				r.created_at as "user.role.createdAt",
				r.updated_at as "user.role.updatedAt"
			FROM refresh_tokens rt
			INNER JOIN users u ON rt.user_id = u.id
			INNER JOIN roles r ON u.role_id = r.id
			WHERE rt.id = ${id}::uuid
		`;

		if (result.length === 0) return null;

		const row = result[0];
		return {
			id: row.id,
			token: row.token,
			userId: row.userId,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			isRevoked: row.isRevoked,
			user: {
				id: row['user.id'],
				email: row['user.email'],
				phone: row['user.phone'],
				name: row['user.name'],
				image: row['user.image'],
				emailVerified: row['user.emailVerified'],
				emailVerifiedAt: row['user.emailVerifiedAt'],
				roleId: row['user.roleId'],
				createdAt: row['user.createdAt'],
				updatedAt: row['user.updatedAt'],
				role: {
					id: row['user.role.id'],
					name: row['user.role.name'],
					description: row['user.role.description'],
					createdAt: row['user.role.createdAt'],
					updatedAt: row['user.role.updatedAt'],
				},
			},
		};
	},

	/**
	 * Mark a refresh token as revoked
	 */
	async revoke(id: string) {
		return queueWrite(() =>
			db.refreshToken.update({
				where: { id },
				data: { isRevoked: true },
			})
		);
	},

	/**
	 * Revoke all tokens for a user
	 */
	async revokeAllForUser(userId: string) {
		return queueWrite(() =>
			db.refreshToken.updateMany({
				where: { userId, isRevoked: false },
				data: { isRevoked: true },
			})
		);
	},

	/**
	 * Delete expired tokens
	 */
	async deleteExpired() {
		return queueWrite(() =>
			db.refreshToken.deleteMany({
				where: {
					expiresAt: {
						lt: new Date(),
					},
				},
			})
		);
	},
};
