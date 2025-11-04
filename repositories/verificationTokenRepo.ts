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
		return db.verificationToken.findUnique({
			where: { token },
			include: { user: { include: { role: true } } },
		});
	},

	/**
	 * Find valid (unused and not expired) token by token string
	 */
	async findValidToken(token: string) {
		return db.verificationToken.findFirst({
			where: {
				token,
				usedAt: null,
				expiresAt: {
					gt: new Date(),
				},
			},
			include: { user: { include: { role: true } } },
		});
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
