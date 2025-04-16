import pino from 'pino';
import { IsProd } from '@/config';

const transport = {
	target: 'pino-pretty',
	options: {
		colorize: true,
		translateTime: 'SYS:standard',
		ignore: 'pid,hostname',
	},
};

export const logger = pino({
	level: IsProd() ? 'error' : 'debug',
	transport: IsProd() ? undefined : transport,
});

// Override console methods
const originalConsole = { ...console };

console.log = (...args) => {
	logger.info(...args);
	if (!IsProd()) {
		originalConsole.log(...args);
	}
};

console.error = (...args) => {
	logger.error(...args);
	originalConsole.error(...args);
};

console.warn = (...args) => {
	logger.warn(...args);
	if (!IsProd()) {
		originalConsole.warn(...args);
	}
};

console.info = (...args) => {
	logger.info(...args);
	if (!IsProd()) {
		originalConsole.info(...args);
	}
};

console.debug = (...args) => {
	logger.debug(...args);
	if (!IsProd()) {
		originalConsole.debug(...args);
	}
};
