import AppConfig from '@/config/AppConfig';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(AppConfig.tz);

export const Environment = {
	PRODUCTION: 'production',
	STAGING: 'staging',
	DEVELOPMENT: 'development',
	CANARY: 'canary',
	LOCAL: 'local',
};

export const IsDev = () => {
	return AppConfig.env === Environment.DEVELOPMENT;
};

export const IsStag = () => {
	return AppConfig.env === Environment.STAGING;
};

export const IsProd = () => {
	return AppConfig.env === Environment.PRODUCTION;
};

export const IsCanary = () => {
	return AppConfig.env === Environment.CANARY;
};

export const IsLocal = () => {
	return AppConfig.env === Environment.LOCAL;
};
