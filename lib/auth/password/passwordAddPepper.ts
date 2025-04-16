import AppConfig from '@/config/AppConfig';

export default function passwordAddPepper(password: string) {
	return `${password}${AppConfig.auth.passwordPepperSecret}`;
}
