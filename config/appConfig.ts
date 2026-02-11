import env from '@/config/env';
import dayjs from 'dayjs';
import { toInt } from 'diginext-utils/object';
import type { StringValue } from 'ms';

const appConfig = {
	port: parseInt(process.env.PORT || '3000', 10),
	env: env('ENV', true, process.env.NODE_ENV),
	tz: env('TZ', true, 'Asia/Ho_Chi_Minh'),
	title: process.env.TITLE,
	database: {
		url: env('DATABASE_URL', false),
	},

	normalize(str: string) {
		try {
			let result = str;
			if (result?.endsWith('/')) result = result.slice(0, -1);
			if (!result?.startsWith('/')) result = `/${result}`;
			return result;
		} catch (error) {
			throw new Error(`normalize  failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	mail: {
		from: env('MAIL_FROM', true, 'noreply@ult.vn'),
	},

	sendgrid: {
		apiKey() {
			return env('SENDGRID_API_KEY', false);
		},
		fromEmail: env('SENDGRID_FROM_EMAIL', true, 'noreply@ult.vn'),
	},

	auth: {
		passwordPepperSecret: env('PASSWORD_PEPPER_SECRET', false),
	},

	jwt: {
		accessTokenSecret: env('ACCESS_TOKEN_SECRET', false),
		refreshTokenSecret: env('REFRESH_TOKEN_SECRET', false),
		accessTokenExpiresIn: env('ACCESS_TOKEN_EXPIRES_IN', true, '30d') as StringValue,
		refreshTokenExpiresIn: env('REFRESH_TOKEN_EXPIRES_IN', true, '30d') as StringValue,
	},

	redis: {
		// redis[s]://[[username][:password]@][host][:port][/db-number]
		cacheDuration: env('REDIS_CACHE_DURATION', true, 60),
		prov: env('REDIS_PROV', process.env.ENV == 'local', 'redis://'),
		host: env('REDIS_HOST', process.env.ENV == 'local', '127.0.0.1'),
		port: toInt(env('REDIS_PORT', process.env.ENV == 'local', 6379)),
		password: env('REDIS_PASSWORD'),
		username: env('REDIS_USERNAME'),
		db: toInt(env('REDIS_DB', true, 0)),

		url() {
			const cred = this.username && this.password ? `${this.username}:${this.password}@` : '';
			return `${this.prov}${cred}${this.host}:${this.port}`;
		},
	},

	route: {
		home(path: string) {
			path = appConfig.normalize(path);
			return appConfig.getWebappUrl(`/${path}`);
		},
	},

	getWebappUrl(url = '') {
		url = appConfig.normalize(url);
		return `${env('WEBAPP_URL', false, '')}${url}`;
	},

	getBaseUrl: (url = '') => {
		url = appConfig.normalize(url);
		return `${env('BASE_URL', true, '')}${url}`;
	},

	upfileBest: {
		getUploadUrl(url = '') {
			url = appConfig.normalize(url);
			return `${env('UPFILE_BEST_UPLOAD', false)}${url}`;
		},
		getUploadDir(url = '') {
			const YYYYMMDD = dayjs().format('YY/MM/DD/HH/mm');
			url = appConfig.normalize(url);
			return `${env('UPFILE_BEST_UPLOAD_DIR_PATH', false)}/upload/${YYYYMMDD}${url}`;
		},
		getCdn(url = '') {
			url = appConfig.normalize(url);
			return `${env('CLOUDFLARE_CDN_DOMAIN', false)}${url}`;
		},
	},
} as const;

export default appConfig;
