import pino from 'pino';
import env from '@/config/env';
import { isProd } from '@/config';

const transport = {
	target: 'pino-pretty',
	options: {
		colorize: true,
		translateTime: 'SYS:standard',
		ignore: 'pid,hostname',
	},
};

export const logger = pino({
	level: env('LOGGER_LEVEL', true, 'info'),
	transport: isProd ? undefined : transport,
});

// Override console methods
const originalConsole = { ...console };

console.log = (...args) => {
	logger.info(...args);
	if (!isProd) {
		originalConsole.log(...args);
	}
};

console.error = (...args) => {
	logger.error(...args);
	originalConsole.error(...args);
};

console.warn = (...args) => {
	logger.warn(...args);
	if (!isProd) {
		originalConsole.warn(...args);
	}
};

console.info = (...args) => {
	logger.info(...args);
	if (!isProd) {
		originalConsole.info(...args);
	}
};

console.debug = (...args) => {
	logger.debug(...args);
	if (!isProd) {
		originalConsole.debug(...args);
	}
};
