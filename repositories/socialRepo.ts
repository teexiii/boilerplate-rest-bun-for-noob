import { db } from '@/lib/server/db';
import type { UserSocials } from '@/types';
import type { Social } from '@prisma/client';

export const socialRepo = {
	/**
	 * Find user by social provider and providerId (with raw SQL)
	 */
	async findUserByProviderAndId(provider: string, providerId: string) {
		const result = await db.$queryRaw<any[]>`
			SELECT
				u.id,
				u.email,
				u.phone,
				u.name,
				u.image,
				u.email_verified as "emailVerified",
				u.email_verified_at as "emailVerifiedAt",
				u.role_id as "roleId",
				u.created_at as "createdAt",
				u.updated_at as "updatedAt",
				r.id as "role.id",
				r.name as "role.name",
				r.description as "role.description",
				r.created_at as "role.createdAt",
				r.updated_at as "role.updatedAt",
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
			LEFT JOIN roles r ON u.role_id = r.id
			LEFT JOIN socials s ON u.id = s.user_id
			WHERE u.id IN (
				SELECT user_id
				FROM socials
				WHERE provider = ${provider}
				AND provider_id = ${providerId}
			)
			GROUP BY u.id, r.id
			LIMIT 1
		`;

		if (result.length === 0) return null;

		const row = result[0];
		return {
			id: row.id,
			email: row.email,
			phone: row.phone,
			name: row.name,
			image: row.image,
			emailVerified: row.emailVerified,
			emailVerifiedAt: row.emailVerifiedAt,
			roleId: row.roleId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			role: {
				id: row['role.id'],
				name: row['role.name'],
				description: row['role.description'],
				createdAt: row['role.createdAt'],
				updatedAt: row['role.updatedAt'],
			},
			socials: row.socials,
		} as UserSocials;
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
