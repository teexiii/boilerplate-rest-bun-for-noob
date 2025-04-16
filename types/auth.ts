// src/types/auth.ts

import type { UserResponse, UserWithRole } from '@/types/user';
import type pino from 'pino';

export interface TokenPayload {
	userId: string;
	roleId: string;
	roleName: string;
}

export interface RefreshTokenPayload {
	tokenId: string;
	userId: string;
}

export interface AuthResponse {
	accessToken: string;
	refreshToken: string;
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

export interface UserInRequest extends UserWithRole {
	isAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
	user?: UserInRequest;
	log?: pino.Logger;
	logEnd?: (statusCode: number, error?: any) => void;
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
