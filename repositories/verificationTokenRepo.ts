import { db } from '@/lib/server/db';
import type { VerificationTokenType } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Default expiration times for different token types (in milliseconds)
 */
const TOKEN_EXPIRATION = {
	EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
	PASSWORD_RESET: 1 * 60 * 60 * 1000, // 1 hour
	EMAIL_CHANGE: 1 * 60 * 60 * 1000, // 1 hour
};

export const verificationTokenRepo = {
	/**
	 * Generate a random secure token
	 */
	generateToken(): string {
		return randomBytes(32).toString('hex');
	},

	/**
	 * Create a new verification token
	 */
	async create(userId: string, type: VerificationTokenType, expiresIn?: number): Promise<string> {
		const token = this.generateToken();
		const expiration = expiresIn || TOKEN_EXPIRATION[type];
		const expiresAt = new Date(Date.now() + expiration);

		const verificationToken = await db.verificationToken.create({
			data: {
				token,
				type,
				userId,
				expiresAt,
			},
		});

		return verificationToken.token;
	},

	/**
	 * Find verification token by token string
	 */
	async findByToken(token: string) {
		const result = await db.$queryRaw<any[]>`
			SELECT
				vt.id,
				vt.token,
				vt.type,
				vt.user_id as "userId",
				vt.expires_at as "expiresAt",
				vt.created_at as "createdAt",
				vt.used_at as "usedAt",
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
			FROM verification_tokens vt
			INNER JOIN users u ON vt.user_id = u.id
			INNER JOIN roles r ON u.role_id = r.id
			WHERE vt.token = ${token}
		`;

		if (result.length === 0) return null;

		const row = result[0];
		return {
			id: row.id,
			token: row.token,
			type: row.type,
			userId: row.userId,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			usedAt: row.usedAt,
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
	 * Find valid (unused and not expired) token by token string
	 */
	async findValidToken(token: string) {
		const result = await db.$queryRaw<any[]>`
			SELECT
				vt.id,
				vt.token,
				vt.type,
				vt.user_id as "userId",
				vt.expires_at as "expiresAt",
				vt.created_at as "createdAt",
				vt.used_at as "usedAt",
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
			FROM verification_tokens vt
			INNER JOIN users u ON vt.user_id = u.id
			INNER JOIN roles r ON u.role_id = r.id
			WHERE vt.token = ${token}
			AND vt.used_at IS NULL
			AND vt.expires_at > NOW()
		`;

		if (result.length === 0) return null;

		const row = result[0];
		return {
			id: row.id,
			token: row.token,
			type: row.type,
			userId: row.userId,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			usedAt: row.usedAt,
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
	 * Mark a verification token as used
	 */
	async markAsUsed(token: string) {
		return db.verificationToken.update({
			where: { token },
			data: { usedAt: new Date() },
		});
	},

	/**
	 * Delete all tokens for a user of a specific type
	 */
	async deleteAllForUser(userId: string, type?: VerificationTokenType) {
		return db.verificationToken.deleteMany({
			where: {
				userId,
				...(type && { type }),
			},
		});
	},

	/**
	 * Delete expired tokens
	 */
	async deleteExpired() {
		return db.verificationToken.deleteMany({
			where: {
				expiresAt: {
					lt: new Date(),
				},
			},
		});
	},

	/**
	 * Delete used tokens older than specified days
	 */
	async deleteOldUsedTokens(daysOld = 7) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysOld);

		return db.verificationToken.deleteMany({
			where: {
				usedAt: {
					not: null,
					lt: cutoffDate,
				},
			},
		});
	},

	/**
	 * Get latest verification tokens by userId with type
	 */
	async getLatestByUserId(userId: string, type?: VerificationTokenType) {
		return db.verificationToken.findMany({
			where: {
				userId,
				...(type && { type }),
			},
			select: {
				type: true,
				createdAt: true,
				expiresAt: true,
				usedAt: true,
			},
			orderBy: {
				createdAt: 'desc',
			},
			take: 10, // Limit to last 10 tokens
		});
	},

	/**
	 * Count tokens created within a time period for rate limiting
	 */
	async countRecentTokens(userId: string, type: VerificationTokenType, minutes: number = 60) {
		const cutoffDate = new Date(Date.now() - minutes * 60 * 1000);

		return db.verificationToken.count({
			where: {
				userId,
				type,
				createdAt: {
					gte: cutoffDate,
				},
			},
		});
	},
};
