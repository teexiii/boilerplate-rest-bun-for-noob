import appConfig from '@/config/appConfig';
import { generateRefreshToken } from '@/lib/auth/jwt';
import { timeToMs } from '@/lib/auth/jwt/time';
import { refreshTokenRepo } from '@/repositories/refreshTokenRepo';
import type { UserWithRole } from '@/types/user';
import { v7 } from 'uuid';

export const refreshTokenService = {
	async generateRefreshTokenByUser(user: UserWithRole) {
		try {
			const id = v7();
			const expiration = timeToMs(appConfig.jwt.refreshTokenExpiresIn);
			const expiresAt = new Date(Date.now() + expiration);
			const refreshTokenToken = await generateRefreshToken(user, id);

			const data = { id, token: refreshTokenToken, expiresAt, userId: user.id };

			// Create refresh token in DB and get the ID
			return await refreshTokenRepo.create({
				id,
				token: refreshTokenToken,
				expiresAt,
				userId: user.id,
			});
		} catch (error) {
			throw new Error(
				`generateRefreshTokenByUserId failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	},
};
