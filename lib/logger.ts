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

// Override console methods - use Pino for structured logging
const originalConsole = { ...console };

console.log = (...args) => {
	if (!isProd) {
		originalConsole.log(...args);
	} else {
		logger.info(...args);
	}
};

console.error = (...args) => {
	// Fixed: Apply same guard as other methods to prevent double logging in production
	if (!isProd) {
		originalConsole.error(...args);
	} else {
		logger.error(...args);
	}
};

console.warn = (...args) => {
	if (!isProd) {
		originalConsole.warn(...args);
	} else {
		logger.warn(...args);
	}
};

console.info = (...args) => {
	if (!isProd) {
		originalConsole.info(...args);
	} else {
		logger.info(...args);
	}
};

console.debug = (...args) => {
	if (!isProd) {
		originalConsole.debug(...args);
	} else {
		logger.debug(...args);
	}
};
