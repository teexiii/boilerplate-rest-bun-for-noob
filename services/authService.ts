import { AppRoleDefault } from '@/data';
import { checkCorrectPassword, hashPassword } from '@/lib/auth/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { refreshTokenRepo } from '@/repositories/refreshTokenRepo';
import { verificationTokenRepo } from '@/repositories/verificationTokenRepo';
import { userRepo } from '@/repositories/userRepo';
import { roleService } from '@/services/roleService';
import type {
	RegisterInput,
	AuthResponse,
	LoginInput,
	TokenRefreshInput,
	VerifyEmailInput,
	ResendVerificationInput,
	ForgotPasswordInput,
	ResetPasswordInput,
	ChangePasswordInput,
	ChangeEmailInput,
	VerifyEmailChangeInput,
} from '@/types/auth';
import { toUserReponse } from '@/types/user';
import { emailService } from '@/services/emailService';
import { userService } from '@/services/userService';
import { refreshTokenService } from '@/services/refreshTokenService';

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

		await this.sendVerificationEmail(user.id);

		// Generate tokens
		const accessToken = await generateAccessToken(user);
		const refreshToken = await refreshTokenService.generateRefreshTokenByUser(user);

		return {
			session: { accessToken, refreshToken: refreshToken.token },
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
		const accessToken = await generateAccessToken(user);

		const refreshToken = await refreshTokenService.generateRefreshTokenByUser(user);

		return {
			session: { accessToken, refreshToken: refreshToken.token },
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
			const accessToken = await generateAccessToken(user);

			const newToken = await refreshTokenService.generateRefreshTokenByUser(user);

			return {
				accessToken,
				refreshToken: newToken.token,
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

	/**
	 * Send email verification token
	 * Note: In a real application, this would send an email
	 * For now, it just creates the token in the database
	 */
	async sendVerificationEmail(userId: string): Promise<{ token: string; message: string }> {
		// Create new verification token
		// Note: Old tokens are not deleted to allow rate limiting to work correctly
		// Invalid/expired tokens are handled by findValidToken
		const token = await verificationTokenRepo.create(userId, 'EMAIL_VERIFICATION');

		const user = await userService.getUserById(userId);

		// DO_NOT_AWAIT
		emailService.sendVerificationEmail(user.email, token);

		return {
			token,
			message: 'Verification email sent successfully',
		};
	},

	/**
	 * Verify user email
	 */
	async verifyEmail(input: VerifyEmailInput): Promise<{ message: string }> {
		// Find the token
		const tokenDoc = await verificationTokenRepo.findValidToken(input.token);

		if (!tokenDoc || tokenDoc.type !== 'EMAIL_VERIFICATION') {
			throw new Error('Invalid or expired verification token', { cause: 400 });
		}

		// Mark user email as verified
		await userRepo.markEmailAsVerified(tokenDoc.userId);

		// Mark token as used
		await verificationTokenRepo.markAsUsed(input.token);

		return {
			message: 'Email verified successfully',
		};
	},

	/**
	 * Resend verification email
	 */
	async resendVerificationEmail(input: ResendVerificationInput): Promise<{ token: string; message: string }> {
		// Find user
		const user = await userRepo.findByEmail(input.email);

		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}

		if (user.emailVerified) {
			throw new Error('Email already verified', { cause: 400 });
		}

		// Check rate limit (e.g., max 5 emails per hour)
		const recentCount = await verificationTokenRepo.countRecentTokens(user.id, 'EMAIL_VERIFICATION', 60);
		if (recentCount >= 5) {
			throw new Error('Too many verification emails sent. Please try again later.', { cause: 429 });
		}

		return this.sendVerificationEmail(user.id);
	},

	/**
	 * Check rate limit for email sending by email address
	 */
	async checkRateLimit(email: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'EMAIL_CHANGE') {
		// Find user by email
		const user = await userRepo.findByEmail(email);

		// If user doesn't exist, return safe default to avoid email enumeration
		if (!user) {
			return {
				email,
				type,
				count: 0,
				limit: type === 'EMAIL_VERIFICATION' ? 5 : 3,
				remaining: type === 'EMAIL_VERIFICATION' ? 5 : 3,
				canSend: true,
			};
		}

		// Get the actual count
		const count = await verificationTokenRepo.countRecentTokens(user.id, type, 60);
		const limit = type === 'EMAIL_VERIFICATION' ? 5 : 3;
		const remaining = Math.max(0, limit - count);
		const canSend = count < limit;

		return {
			email,
			type,
			count,
			limit,
			remaining,
			canSend,
		};
	},

	/**
	 * Check if a verification token is valid
	 */
	async checkVerificationToken(token: string) {
		const tokenDoc = await verificationTokenRepo.findValidToken(token);

		if (!tokenDoc) {
			throw new Error('Invalid or expired verification token', { cause: 400 });
		}

		const { user } = tokenDoc;

		// Generate tokens
		const accessToken = await generateAccessToken(user);
		const refreshToken = await refreshTokenService.generateRefreshTokenByUser(user);

		return {
			valid: true,
			type: tokenDoc.type,
			expiresAt: tokenDoc.expiresAt,
			user: toUserReponse(user),
			session: { accessToken, refreshToken: refreshToken.token },
		};
	},

	/**
	 * Get latest verification tokens for authenticated user
	 */
	async getLatestVerificationTokens(userId: string, type?: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'EMAIL_CHANGE') {
		const tokens = await verificationTokenRepo.getLatestByUserId(userId, type);

		// Build rate limit info based on requested type
		let rateLimitInfo: any = {};

		if (!type || type === 'EMAIL_VERIFICATION') {
			const count = await verificationTokenRepo.countRecentTokens(userId, 'EMAIL_VERIFICATION', 60);
			rateLimitInfo = {
				type: 'EMAIL_VERIFICATION',
				count,
				limit: 5,
				// windowMinutes: 60,
			};
		}

		if (!type || type === 'PASSWORD_RESET') {
			const count = await verificationTokenRepo.countRecentTokens(userId, 'PASSWORD_RESET', 60);
			rateLimitInfo = {
				type: 'PASSWORD_RESET',
				count,
				limit: 3,
				// windowMinutes: 60,
			};
		}

		if (!type || type === 'EMAIL_CHANGE') {
			const count = await verificationTokenRepo.countRecentTokens(userId, 'EMAIL_CHANGE', 60);
			rateLimitInfo = {
				type: 'EMAIL_CHANGE',
				count,
				limit: 3,
				// windowMinutes: 60,
			};
		}

		return {
			tokens,
			rateLimitInfo,
		};
	},

	/**
	 * Initiate forgot password flow
	 */
	async forgotPassword(input: ForgotPasswordInput): Promise<{ token: string; message: string }> {
		// Find user
		const user = await userRepo.findByEmail(input.email);

		if (!user) {
			// Don't reveal that user doesn't exist for security
			return {
				token: '',
				message: 'If the email exists, a password reset link has been sent',
			};
		}

		// Check rate limit (e.g., max 3 password reset emails per hour)
		const recentCount = await verificationTokenRepo.countRecentTokens(user.id, 'PASSWORD_RESET', 60);
		if (recentCount >= 3) {
			throw new Error('Too many password reset requests. Please try again later.', { cause: 429 });
		}

		// Create new reset token
		// Note: Old tokens are not deleted to allow rate limiting to work correctly
		// Invalid/expired tokens are handled by findValidToken
		const token = await verificationTokenRepo.create(user.id, 'PASSWORD_RESET');

		emailService.sendPasswordResetEmail(user.email, token);

		return {
			token,
			message: 'If the email exists, a password reset link has been sent',
		};
	},

	/**
	 * Reset password using token
	 */
	async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
		// Validate new password
		if (!input.newPassword || input.newPassword.length < 6) {
			throw new Error('Password must be at least 6 characters long', { cause: 400 });
		}

		// Find the token
		const tokenDoc = await verificationTokenRepo.findValidToken(input.token);

		if (!tokenDoc || tokenDoc.type !== 'PASSWORD_RESET') {
			throw new Error('Invalid or expired reset token', { cause: 400 });
		}

		// Hash new password
		const hashedPassword = await hashPassword(input.newPassword);

		// Update user password
		await userRepo.updatePassword(tokenDoc.userId, hashedPassword);

		// Mark token as used
		await verificationTokenRepo.markAsUsed(input.token);

		// Revoke all refresh tokens to force re-login
		await refreshTokenRepo.revokeAllForUser(tokenDoc.userId);

		return {
			message: 'Password reset successfully',
		};
	},

	/**
	 * Change password for authenticated user
	 */
	async changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }> {
		// Validate new password
		if (!input.newPassword || input.newPassword.length < 6) {
			throw new Error('Password must be at least 6 characters long', { cause: 400 });
		}

		// Get user
		const user = await userRepo.findById(userId);

		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}

		if (!user.password) {
			throw new Error('Password not set for this account', { cause: 400 });
		}

		// Verify current password
		const validPassword = await checkCorrectPassword(user.password, input.currentPassword);

		if (!validPassword) {
			throw new Error('Current password is incorrect', { cause: 400 });
		}

		// Hash new password
		const hashedPassword = await hashPassword(input.newPassword);

		// Update user password
		await userRepo.updatePassword(userId, hashedPassword);

		// Optionally revoke all refresh tokens except the current one
		// For now, let's revoke all to force re-login on all devices
		await refreshTokenRepo.revokeAllForUser(userId);

		return {
			message: 'Password changed successfully. Please login again.',
		};
	},

	/**
	 * Initiate email change
	 */
	async changeEmail(userId: string, input: ChangeEmailInput): Promise<{ token: string; message: string }> {
		// Check rate limit (e.g., max 3 email change requests per hour)
		const recentCount = await verificationTokenRepo.countRecentTokens(userId, 'EMAIL_CHANGE', 60);
		if (recentCount >= 3) {
			throw new Error('Too many email change requests. Please try again later.', { cause: 429 });
		}

		// Check if email is already taken
		const existingUser = await userRepo.findByEmail(input.newEmail);

		if (existingUser) {
			throw new Error('Email already in use', { cause: 400 });
		}

		// Get user
		const user = await userRepo.findById(userId);

		if (!user) {
			throw new Error('User not found', { cause: 404 });
		}

		if (!user.password) {
			throw new Error('Password not set for this account', { cause: 400 });
		}

		// Verify password
		const validPassword = await checkCorrectPassword(user.password, input.password);

		if (!validPassword) {
			throw new Error('Password is incorrect', { cause: 400 });
		}

		// Create new email change token
		// Note: Old tokens are not deleted to allow rate limiting to work correctly
		// Invalid/expired tokens are handled by findValidToken
		const token = await verificationTokenRepo.create(userId, 'EMAIL_CHANGE');

		// Store new email temporarily (you might want to create a separate table for this)
		// For now, we'll require the new email to be passed in the verification step

		// TODO: Send verification email to NEW email address
		// await emailService.sendEmailChangeVerification(input.newEmail, token);

		return {
			token,
			message: 'Verification email sent to new email address',
		};
	},

	/**
	 * Verify email change
	 * Note: In a real application, the new email would be sent with the token
	 * or stored temporarily. For this implementation, we'll need to pass it again.
	 */
	async verifyEmailChange(
		userId: string,
		newEmail: string,
		input: VerifyEmailChangeInput
	): Promise<{ message: string }> {
		// Find the token
		const tokenDoc = await verificationTokenRepo.findValidToken(input.token);

		if (!tokenDoc || tokenDoc.type !== 'EMAIL_CHANGE' || tokenDoc.userId !== userId) {
			throw new Error('Invalid or expired verification token', { cause: 400 });
		}

		// Check if email is still available
		const existingUser = await userRepo.findByEmail(newEmail);

		if (existingUser) {
			throw new Error('Email already in use', { cause: 400 });
		}

		// Update user email
		await userRepo.updateEmail(userId, newEmail);

		// Mark token as used
		await verificationTokenRepo.markAsUsed(input.token);

		// Revoke all refresh tokens to force re-login
		await refreshTokenRepo.revokeAllForUser(userId);

		return {
			message: 'Email changed successfully. Please login with your new email.',
		};
	},
};
