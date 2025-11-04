import appConfig from '@/config/appConfig';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(appConfig.tz);

export const Environment = {
	PRODUCTION: 'production',
	STAGING: 'staging',
	DEVELOPMENT: 'development',
	CANARY: 'canary',
	LOCAL: 'local',
};

export const isDev = appConfig.env === Environment.DEVELOPMENT;
export const isStag = appConfig.env === Environment.STAGING;
export const isProd = appConfig.env === Environment.PRODUCTION;
export const isCanary = appConfig.env === Environment.CANARY;
export const isLocal = appConfig.env === Environment.LOCAL || process.env.NODE_ENV === 'test';
