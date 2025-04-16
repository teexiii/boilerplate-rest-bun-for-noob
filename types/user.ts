import type { User, Role } from '@prisma/client';

// Add this interface to represent user social logins
export interface SocialInfo {
	id: string;
	provider: string;
	providerId: string;
	email?: string;
	profileData?: Record<string, any>;
}

export type UserWithRole = User & {
	role: Role;
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
}

export interface UserResponse {
	id: string;
	email: string;
	name: string | null;
	role: {
		id: string;
		name: string;
	};
	socials?: {
		provider: string;
		email: string | null;
	}[];
	createdAt: Date;
}

export const toUserReponse = (
	user: User & {
		role: Pick<Role, 'id' | 'name'>;
		socials?: {
			provider: string;
			email: string | null;
		}[];
	}
): UserResponse => {
	try {
		return {
			id: user.id,
			email: user.email,
			name: user.name || user.email,
			role: {
				name: user.role.name,
				id: user.role.id,
			},
			socials: user.socials?.map((sl: { provider: any; email: any }) => ({
				provider: sl.provider,
				email: sl.email!,
			})),
			createdAt: user.createdAt,
		};
	} catch (error) {
		throw new Error(`UserReponse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};

export interface ChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}
