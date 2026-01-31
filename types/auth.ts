import type { UserResponse, UserWithRole } from '@/types/user';

export interface TokenPayload {
	userId: string;
	roleId: string;
	roleName: string;
	iat?: number;
	exp?: number;
}

export interface RefreshTokenPayload {
	tokenId: string;
	userId: string;
}

export interface AuthResponse {
	session: {
		accessToken: string;
		refreshToken: string;
	};
	user: UserResponse;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface RegisterInput extends LoginInput {
	name?: string;
}

export interface TokenRefreshInput {
	refreshToken: string;
}

export interface VerifyEmailInput {
	token: string;
}

export interface ResendVerificationInput {
	email: string;
}

export interface ForgotPasswordInput {
	email: string;
}

export interface ResetPasswordInput {
	token: string;
	newPassword: string;
}

export interface ChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}

export interface ChangeEmailInput {
	newEmail: string;
	password: string;
}

export interface VerifyEmailChangeInput {
	token: string;
}

export interface UserInRequest extends UserWithRole {
	isAdmin: boolean;
	// isTokenExpiringSoon?: boolean;
}

/**
 * Lightweight logger interface for request logging
 * Avoids creating Pino child logger objects per request
 */
export interface RequestLogger {
	info: (data: any) => void;
	error: (data: any) => void;
	warn: (data: any) => void;
	debug: (data: any) => void;
}

export interface AuthenticatedRequest extends Request {
	user?: UserInRequest;
	log?: RequestLogger;
	logEnd?: (statusCode: number, error?: any) => void;
	clientIp?: string | null;
	socketIp?: string | null;
}

export interface RouteParams {
	[key: string]: string;
}

export interface RouteHandler {
	(req: AuthenticatedRequest, params: RouteParams): Promise<(...args: any[]) => Promise<Response>>;
}

export interface Route {
	path: string;
	method: string;
	handler: RouteHandler;
	middleware?: Array<(req: AuthenticatedRequest, params: RouteParams) => Promise<Response | null>>;
}
