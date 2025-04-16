import passwordAddPepper from '@/lib/auth/password/passwordAddPepper';

export default async function hashPassword(password: string) {
	return await Bun.password.hash(passwordAddPepper(password));
}
