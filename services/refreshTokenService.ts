import appConfig from '@/config/appConfig';
import { generateRefreshToken } from '@/lib/auth/jwt';
import { timeToMs } from '@/lib/auth/jwt/time';
import { refreshTokenRepo } from '@/repositories/refreshTokenRepo';
import type { UserWithRole } from '@/types/user';

export const refreshTokenService = {
	async generateRefreshTokenByUser(user: Pick<UserWithRole, 'id'>) {
		try {
			const expiration = timeToMs(appConfig.jwt.refreshTokenExpiresIn);
			const expiresAt = new Date(Date.now() + expiration);

			// Create record first — let Prisma auto-generate UUID
			const record = await refreshTokenRepo.create({
				token: '_pending_',
				expiresAt,
				userId: user.id,
			});

			// Generate JWT with DB-assigned id as tokenId
			const refreshTokenToken = await generateRefreshToken(user, record.id);

			// Update with actual JWT token
			return await refreshTokenRepo.updateToken(record.id, refreshTokenToken);
		} catch (error) {
			throw new Error(
				`generateRefreshTokenByUserId failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	},
};
