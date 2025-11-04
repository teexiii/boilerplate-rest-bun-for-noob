import env from '@/config/env';
import { AppPermissionDefault, AppRoleDefault } from '@/data';
import { hashPassword } from '@/lib/auth/password';
import { Prisma, PrismaClient, type Permission } from '@prisma/client';

const prisma = new PrismaClient();

async function findOrCreatePermission(name: string) {
	const existingPermission = await prisma.permission.findFirst({
		where: { name },
	});
	if (!existingPermission) {
		return prisma.permission.create({ data: { name } });
	}
	return existingPermission;
}

// Check if role exists, if not create
async function findOrCreateRole(name: string, permissions: Permission[]) {
	const existingRole = await prisma.role.findFirst({ where: { name } });

	if (!existingRole) {
		const rolePermissions = permissions.map((permission: Permission) => ({
			permission: { connect: { id: permission.id } },
		}));
		return prisma.role.create({
			data: {
				name,
				rolePermissions: {
					create: rolePermissions,
				},
			},
		});
	}
	return existingRole;
}

// Default users to create
const defaultUsers = Array(10)
	.fill(null)
	.map((_, id) => ({
		email: `user-${id}`,
		password: 'User123#',
		name: `User ${id}`,
		role: AppRoleDefault.VIEWER,
	}));

/**
 * Find or create a user
 */
const findOrCreateUser = async (data: any, roleId: string) => {
	try {
		const existingUser = await prisma.user.findFirst({ where: { email: data.email } });
		if (existingUser) return existingUser;

		const hashedUserPassword = await hashPassword(data.password);

		const user = await prisma.user.create({
			data: {
				email: data.email,
				password: hashedUserPassword,
				name: data.name,
				roleId,
			},
			include: { role: true },
		});

		return user;
	} catch (error) {
		console.error(`findOrCreateUser failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		throw error;
	}
};

async function main() {
	// In your seed script
	const fullControlPermission = await findOrCreatePermission(AppPermissionDefault.FULL_CONTROL);
	const writePermission = await findOrCreatePermission(AppPermissionDefault.WRITE);
	const readPermission = await findOrCreatePermission(AppPermissionDefault.READ);

	const adminRole = await findOrCreateRole(AppRoleDefault.ADMIN, [
		writePermission,
		readPermission,
		fullControlPermission,
	]);
	const viewerRole = await findOrCreateRole(AppRoleDefault.VIEWER, [readPermission]);
	const proRole = await findOrCreateRole(AppRoleDefault.PRO, [readPermission]);

	const findOrCreateAdmin = async (email: string) => {
		let existingUser = await prisma.user.findFirst({ where: { email } });

		if (!existingUser) {
			const password = await hashPassword(env('ADMIN_PASSWORD_DEFAULT', false));
			// Create default User_1 with Admin role
			existingUser = await prisma.user.create({
				data: {
					password,
					email,
					name: 'Admin',
					roleId: adminRole.id,
					emailVerified: true,
					emailVerifiedAt: new Date(),
				},
			});
		}

		return existingUser;
	};

	const admin = await findOrCreateAdmin(env('ADMIN_EMAIL_DEFAULT', false));

	// // Create users
	// console.log('Creating users...');
	// const users: Record<string, any> = {};
	// for (const userData of defaultUsers) {
	// 	const roleId = viewerRole.id!;
	// 	users[userData.email] = await findOrCreateUser(userData, roleId);
	// }

	console.log('Seed done');
}

// Execute the main function
main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
