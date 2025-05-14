import jwt from 'jsonwebtoken';
import { JsonWebTokenError, NotBeforeError, TokenExpiredError } from 'jsonwebtoken';
import type { TokenPayload, RefreshTokenPayload } from '@/types/auth';
import type { UserWithRole } from '@/types/user';
import AppConfig from '@/config/AppConfig';

export function generateAccessToken(user: UserWithRole): string {
	const payload: TokenPayload = {
		userId: user.id,
		roleId: user.roleId,
		roleName: user.role.name,
	};
	return jwt.sign(payload, AppConfig.jwt.accessTokenSecret, {
		expiresIn: AppConfig.jwt.accessTokenExpiresIn,
	});
}

export function generateRefreshToken(user: UserWithRole, tokenId: string): string {
	const payload: RefreshTokenPayload = {
		tokenId,
		userId: user.id,
	};

	return jwt.sign(payload, AppConfig.jwt.refreshTokenSecret, {
		expiresIn: AppConfig.jwt.refreshTokenExpiresIn,
	});
}

export function verifyAccessToken(token: string): Promise<TokenPayload> {
	return new Promise((resolve, reject) => {
		jwt.verify(token, AppConfig.jwt.accessTokenSecret, (err: unknown, decoded: unknown) => {
			if (err) {
				// Handle specific types of JWT errors
				if (err instanceof TokenExpiredError) {
					reject({
						cause: 'TOKEN_EXPIRED',
						message: 'Access token has expired',
						expiredAt: err.expiredAt,
					});
				} else if (err instanceof JsonWebTokenError) {
					reject({
						cause: 'TOKEN_INVALID',
						message: 'Invalid access token',
						details: err.message,
					});
				} else if (err instanceof NotBeforeError) {
					reject({
						cause: 'TOKEN_NOT_ACTIVE',
						message: 'Token not yet active',
						date: err.date,
					});
				} else {
					// Generic error for unexpected cases
					reject({
						cause: 'TOKEN_ERROR',
						message: 'Error verifying access token',
						error: err,
					});
				}
			} else {
				resolve(decoded as TokenPayload);
			}
		});
	});
}

export function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
	return new Promise((resolve, reject) => {
		jwt.verify(token, AppConfig.jwt.refreshTokenSecret, (err: unknown, decoded: unknown) => {
			if (err) {
				reject(err);
			} else {
				resolve(decoded as RefreshTokenPayload);
			}
		});
	});
}
