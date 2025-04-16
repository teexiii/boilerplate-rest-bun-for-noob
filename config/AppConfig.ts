import env from '@/config/env';
import { toInt } from 'diginext-utils/dist/object';
import type { StringValue } from 'ms';

const AppConfig = {
	port: parseInt(process.env.PORT || '3000', 10),
	env: env('ENV', true, process.env.NODE_ENV),
	tz: env('TZ', true, 'Asia/Ho_Chi_Minh'),

	database: {
		url: env('DATABASE_URL', false),
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
		prov: env('REDIST_PROV', process.env.ENV == 'local', 'redis://'),
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

	getBaseUrl: (url = '') => {
		// remove it if config trailingSlash: true, on next.config
		if (url?.endsWith('/')) url = url.slice(0, -1);
		if (!url?.startsWith('/')) url = `/${url}`;

		return `${env('BASE_URL', true, '')}${url}`;
	},

	getApiUpfileBestUrl: (url = '') => {
		if (url?.endsWith('/')) url = url.slice(0, -1);
		if (!url?.startsWith('/')) url = `/${url}`;

		return `${env('UPFILE_BEST_FILE_SERVE', false)}${url}`;
	},
};

export default AppConfig;
