import passwordAddPepper from '@/lib/auth/password/passwordAddPepper';

export default async function checkCorrectPassword(userPasswordInDb: string, inputPassword: string) {
	return await Bun.password.verify(passwordAddPepper(inputPassword), userPasswordInDb);
}
