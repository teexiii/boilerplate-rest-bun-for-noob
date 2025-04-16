import { AppRoleDefault } from '@/data';
import { checkCorrectPassword, hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/server/db';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { formatObjectId } from '@/lib/utils/mongo-id';
import { refreshTokenRepo } from '@/repositories/refreshTokenRepo';
import { userRepo } from '@/repositories/userRepo';
import { roleService } from '@/services/roleService';
import type { RegisterInput, AuthResponse, LoginInput, TokenRefreshInput } from '@/types/auth';
import { toUserReponse } from '@/types/user';

export const authService = {
	/**
	 * Register a new user
	 */
	async register(input: RegisterInput): Promise<AuthResponse> {
		// Check if user already exists
		const existingUser = await userRepo.findByEmail(input.email);

		if (existingUser) {
			throw new Error('Email already registered', { cause: 400 });
		}

		const defaultRole = await roleService.getRoleByName(AppRoleDefault.VIEWER);

		if (!defaultRole) {
			throw new Error('Default role not found');
		}

		// Hash password
		const hashedPassword = await hashPassword(input.password);

		// Create user
		const user = await userRepo.create({
			email: input.email,
			password: hashedPassword,
			name: input.name,
			roleId: defaultRole.id,
		});

		// Generate tokens
		const accessToken = generateAccessToken(user);

		// Create refresh token in DB and get the ID
		const refreshTokenId = await refreshTokenRepo.create(
			user.id,
			'' // Will be updated after generation
			// No expiration passed - will use AppConfig value
		);

		// Generate refresh token with ID
		const refreshToken = generateRefreshToken(user, refreshTokenId);

		// Update the token string in the database
		await db.refreshToken.update({
			where: { id: formatObjectId(refreshTokenId) },
			data: { token: refreshToken },
		});

		return {
			accessToken,
			refreshToken,
			user: toUserReponse(user),
		};
	},

	/**
	 * Login a user
	 */
	async login(input: LoginInput, adminOrPro: boolean = false): Promise<AuthResponse> {
		// Find user by email
		const user = await userRepo.findByEmail(input.email);
		if (!user) {
			throw new Error('Incorrect Username Or Password', { cause: 400 });
		}

		if (adminOrPro) {
			if (user.role.name == AppRoleDefault.VIEWER) throw new Error('Need Permission', { cause: 400 });
		}

		if (!user.password) {
			throw new Error('Incorrect Username Or Password', { cause: 400 });
		}

		// Verify password
		const validPassword = await checkCorrectPassword(user.password, input.password);
		if (!validPassword) {
			throw new Error('Incorrect Username Or Password', { cause: 400 });
		}

		// Generate tokens
		const accessToken = generateAccessToken(user);

		// Create refresh token in DB and get the ID
		const refreshTokenId = await refreshTokenRepo.create(
			user.id,
			'' // Will be updated after generation
			// No expiration passed - will use AppConfig value
		);

		// Generate refresh token with ID
		const refreshToken = generateRefreshToken(user, refreshTokenId);

		// Update the token string in the database
		await db.refreshToken.update({
			where: { id: formatObjectId(refreshTokenId) },
			data: { token: refreshToken },
		});

		return {
			accessToken,
			refreshToken,
			user: toUserReponse(user),
		};
	},

	/**
	 * Refresh access token
	 */
	async refreshToken(input: TokenRefreshInput): Promise<{ accessToken: string; refreshToken: string }> {
		const { refreshToken } = input;

		try {
			// Verify the refresh token
			const payload = await verifyRefreshToken(refreshToken);

			// Find the token in the database
			const tokenDoc = await refreshTokenRepo.findById(payload.tokenId);

			if (!tokenDoc || tokenDoc.isRevoked || tokenDoc.expiresAt < new Date() || tokenDoc.token !== refreshToken) {
				throw new Error('Invalid refresh token', { cause: 401 });
			}

			// Get the user
			const user = tokenDoc.user;

			// Revoke the old refresh token
			await refreshTokenRepo.revoke(tokenDoc.id);

			// Generate new tokens
			const accessToken = generateAccessToken(user);

			// Create new refresh token in DB and get the ID
			const newRefreshTokenId = await refreshTokenRepo.create(
				user.id,
				'' // Will be updated after generation
				// 300 * 24 * 60 * 60 * 1000 // 300 days in ms
			);

			// Generate new refresh token with ID
			const newRefreshToken = generateRefreshToken(user, newRefreshTokenId);

			// Update the token string in the database
			await db.refreshToken.update({
				where: { id: formatObjectId(newRefreshTokenId) },
				data: { token: newRefreshToken },
			});

			return {
				accessToken,
				refreshToken: newRefreshToken,
			};
		} catch (error) {
			throw new Error('Invalid refresh token', { cause: 401 });
		}
	},

	/**
	 * Logout a user
	 */
	async logout(refreshToken: string): Promise<void> {
		try {
			// Find the token
			const tokenDoc = await refreshTokenRepo.findByToken(refreshToken);

			if (tokenDoc) {
				// Revoke the token
				await refreshTokenRepo.revoke(tokenDoc.id);
			}
		} catch (error) {
			// Just log the error but don't throw
			console.error('Error during logout:', error);
		}
	},

	/**
	 * Logout from all devices
	 */
	async logoutAll(userId: string): Promise<void> {
		await refreshTokenRepo.revokeAllForUser(userId);
	},
};
