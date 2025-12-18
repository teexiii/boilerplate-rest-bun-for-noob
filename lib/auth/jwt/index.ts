import { SignJWT, jwtVerify, errors } from 'jose';
import type { TokenPayload, RefreshTokenPayload } from '@/types/auth';
import type { UserWithRole } from '@/types/user';
import appConfig from '@/config/appConfig';

// Convert secrets to Uint8Array for jose
const accessTokenSecret = new TextEncoder().encode(appConfig.jwt.accessTokenSecret);
const refreshTokenSecret = new TextEncoder().encode(appConfig.jwt.refreshTokenSecret);

export async function generateAccessToken(user: Pick<UserWithRole, 'id' | 'roleId' | 'role'>): Promise<string> {
	console.log(user?.role);
	const payload: TokenPayload = {
		userId: user.id,
		roleId: user.roleId,
		roleName: user?.role?.name,
	};

	return await new SignJWT(payload as any)
		.setProtectedHeader({ alg: 'HS512' })
		.setExpirationTime(appConfig.jwt.accessTokenExpiresIn)
		.sign(accessTokenSecret);
}

export async function generateRefreshToken(user: Pick<UserWithRole, 'id'>, tokenId: string): Promise<string> {
	const payload: RefreshTokenPayload = {
		tokenId,
		userId: user.id,
	};

	return await new SignJWT(payload as any)
		.setProtectedHeader({ alg: 'HS512' })
		.setExpirationTime(appConfig.jwt.refreshTokenExpiresIn)
		.sign(refreshTokenSecret);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
	try {
		const { payload } = await jwtVerify(token, accessTokenSecret);
		return payload as unknown as TokenPayload;
	} catch (err) {
		// Handle specific types of JWT errors
		if (err instanceof errors.JWTExpired) {
			throw {
				cause: 'TOKEN_EXPIRED',
				message: 'Access token has expired',
				expiredAt: err.claim,
			};
		} else if (err instanceof errors.JWTInvalid) {
			throw {
				cause: 'TOKEN_INVALID',
				message: 'Invalid access token',
				details: err.message,
			};
		} else if (err instanceof errors.JWTClaimValidationFailed) {
			throw {
				cause: 'TOKEN_NOT_ACTIVE',
				message: 'Token not yet active',
				details: err.message,
			};
		} else {
			// Generic error for unexpected cases
			throw {
				cause: 'TOKEN_ERROR',
				message: 'Error verifying access token',
				error: err,
			};
		}
	}
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
	const { payload } = await jwtVerify(token, refreshTokenSecret);
	return payload as unknown as RefreshTokenPayload;
}
