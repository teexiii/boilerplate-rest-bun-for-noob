import AppConfig from '@/config/AppConfig';
import { db } from '@/lib/server/db';
import { timeToMs } from '@/lib/auth/jwt/time';

export const refreshTokenRepo = {
	/**
	 * Create a new refresh token
	 */
	async create(userId: string, token: string, expiresIn?: number): Promise<string> {
		// Use provided expiresIn or calculate from AppConfig
		const expiration = expiresIn || timeToMs(AppConfig.jwt.refreshTokenExpiresIn);
		const expiresAt = new Date(Date.now() + expiration);

		const refreshToken = await db.refreshToken.create({
			data: {
				token,
				userId,
				expiresAt,
			},
		});

		return refreshToken.id;
	},

	/**
	 * Find refresh token by token string
	 */
	async findByToken(token: string) {
		return db.refreshToken.findUnique({
			where: { token },
			include: { user: { include: { role: true } } },
		});
	},

	/**
	 * Find refresh token by ID
	 */
	async findById(id: string) {
		return db.refreshToken.findUnique({
			where: { id },
			include: { user: { include: { role: true } } },
		});
	},

	/**
	 * Mark a refresh token as revoked
	 */
	async revoke(id: string) {
		return db.refreshToken.update({
			where: { id },
			data: { isRevoked: true },
		});
	},

	/**
	 * Revoke all tokens for a user
	 */
	async revokeAllForUser(userId: string) {
		return db.refreshToken.updateMany({
			where: { userId, isRevoked: false },
			data: { isRevoked: true },
		});
	},

	/**
	 * Delete expired tokens
	 */
	async deleteExpired() {
		return db.refreshToken.deleteMany({
			where: {
				expiresAt: {
					lt: new Date(),
				},
			},
		});
	},
};
