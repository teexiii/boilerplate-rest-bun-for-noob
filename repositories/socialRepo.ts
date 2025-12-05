import { db } from '@/lib/server/db';
import type { Social, User } from '@prisma/client';

type UserWithSocials = User & { socials: Social[] };

export const socialRepo = {
	/**
	 * Find user by social provider and providerId (with raw SQL)
	 */
	async findUserByProviderAndId(provider: string, providerId: string): Promise<UserWithSocials | null> {
		const result = await db.$queryRaw<any[]>`
			SELECT
				u.id,
				u.email,
				u.phone,
				u.name,
				u.password,
				u.image,
				u.email_verified as "emailVerified",
				u.email_verified_at as "emailVerifiedAt",
				u.role_id as "roleId",
				u.created_at as "createdAt",
				u.updated_at as "updatedAt",
				COALESCE(
					json_agg(
						json_build_object(
							'id', s.id,
							'createdAt', s.created_at,
							'updatedAt', s.updated_at,
							'provider', s.provider,
							'providerId', s.provider_id,
							'email', s.email,
							'profileData', s.profile_data,
							'userId', s.user_id
						) ORDER BY s.created_at DESC
					) FILTER (WHERE s.id IS NOT NULL),
					'[]'::json
				) as "socials"
			FROM users u
			LEFT JOIN socials s ON u.id = s.user_id
			WHERE u.id IN (
				SELECT user_id
				FROM socials
				WHERE provider = ${provider}
				AND provider_id = ${providerId}
			)
			GROUP BY u.id
			LIMIT 1
		`;

		if (result.length === 0) return null;

		return result[0] as UserWithSocials;
	},

	/**
	 * Find social by provider and providerId (with raw SQL)
	 */
	async findByProviderAndId(provider: string, providerId: string): Promise<Social | null> {
		const result = await db.$queryRaw<any[]>`
			SELECT
				id,
				created_at as "createdAt",
				updated_at as "updatedAt",
				provider,
				provider_id as "providerId",
				email,
				profile_data as "profileData",
				user_id as "userId"
			FROM socials
			WHERE provider = ${provider}
			AND provider_id = ${providerId}
			LIMIT 1
		`;

		return result.length > 0 ? result[0] : null;
	},

	/**
	 * Create a new social login
	 */
	async create(data: {
		userId: string;
		provider: string;
		providerId: string;
		email?: string | null;
		profileData?: any;
	}): Promise<Social> {
		return db.social.create({
			data,
		});
	},

	/**
	 * Count social logins for a user
	 */
	async countByUserId(userId: string): Promise<number> {
		return db.social.count({
			where: { userId },
		});
	},

	/**
	 * Delete social logins by userId and provider
	 */
	async deleteByUserIdAndProvider(userId: string, provider: string): Promise<void> {
		await db.social.deleteMany({
			where: {
				userId,
				provider,
			},
		});
	},

	/**
	 * Find all social logins for a user (with raw SQL)
	 */
	async findByUserId(userId: string): Promise<Pick<Social, 'provider' | 'email'>[]> {
		const result = await db.$queryRaw<any[]>`
			SELECT
				provider,
				email
			FROM socials
			WHERE user_id = ${userId}::uuid
			ORDER BY created_at ASC
		`;

		return result;
	},
};
