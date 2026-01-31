import type { User, Role, Social } from '@prisma/client';
import { toBool } from 'diginext-utils/object';

// Add this interface to represent user social logins
export interface SocialInfo {
	id: string;
	provider: string;
	providerId: string;
	email?: string;
	profileData?: Record<string, any>;
}

export type UserSocials = UserWithRole & {
	socials?: Social[];
};

export type UserWithRole = Omit<User, 'password' | 'blockTurn'> & {
	role: Role;
	password?: string | null;
	blockTurn?: boolean;
};

export interface UserCreateInput {
	email: string;
	password: string;
	name?: string;
	roleId: string;
}

export interface UserUpdateInput {
	email?: string;
	name?: string;
	roleId?: string;
	blockTurn?: boolean;
}

export interface UserResponse {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	emailVerified: boolean;
	blockTurn: boolean;
	role: {
		id: string;
		name: string;
	};
	socials?: {
		provider: string;
		email: string | null;
	}[];
	remainingTurns?: number;
	totalBonusToday?: number;
	sessionCount?: number;
	totalShares?: number;
	totalDownloads?: number;
	createdAt: Date;
}

export const toUserReponse = (
	user: UserSocials & {
		remainingTurns?: number;
		totalBonusToday?: number;
		sessionCount?: number;
		totalShares?: number;
		totalDownloads?: number;
	}
): UserResponse => {
	try {
		return {
			id: user.id,
			email: user.email,
			name: user.name || user.email,
			image: user.image || user.image,
			emailVerified: toBool(user.emailVerified),
			blockTurn: toBool(user.blockTurn),
			role: {
				name: user.role.name,
				id: user.role.id,
			},
			socials: user.socials?.map((sl: { provider: any; email: any }) => ({
				provider: sl.provider,
				email: sl.email!,
			})),
			remainingTurns: user.remainingTurns,
			totalBonusToday: user.totalBonusToday,
			sessionCount: user.sessionCount,
			totalShares: user.totalShares,
			totalDownloads: user.totalDownloads,
			createdAt: user.createdAt,
		};
	} catch (error) {
		throw new Error(`UserReponse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};
