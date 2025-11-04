import appConfig from '@/config/appConfig';

export default function passwordAddPepper(password: string) {
	return `${password}${appConfig.auth.passwordPepperSecret}`;
}
