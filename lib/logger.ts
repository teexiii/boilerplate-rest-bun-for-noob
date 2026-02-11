import { isProd } from '@/config';
import dayjs from 'dayjs';
import { errorLoggerService } from '@/services/errorLoggerService';
import '@/config';

// Timestamp format with timezone offset (e.g., 2026-02-06T20:14:58+07:00)
const TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss Z';

// Store original console methods before overriding
const originalConsole = {
	log: console.log.bind(console),
	info: console.info.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console),
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message?: string;
	[key: string]: unknown;
}

/**
 * Convert Error objects to plain serializable objects (Error props are non-enumerable)
 */
function serializeValue(val: unknown): unknown {
	if (val instanceof Error) {
		const obj: Record<string, unknown> = {
			name: val.name,
			message: val.message,
			stack: val.stack,
		};
		if (val.cause) obj.cause = serializeValue(val.cause);
		return obj;
	}
	if (Array.isArray(val)) return val.map(serializeValue);
	return val;
}

/**
 * Serialize log arguments to a structured format
 */
function serializeArgs(args: unknown[]): { message?: string; data?: unknown } {
	if (args.length === 0) return {};

	// If first arg is string, use as message
	if (typeof args[0] === 'string') {
		const message = args[0];
		if (args.length === 1) return { message };

		// If second arg is an Error, serialize it
		if (args.length === 2 && args[1] instanceof Error) {
			return { message, data: serializeValue(args[1]) };
		}

		// If second arg is an object, spread it
		if (args.length === 2 && typeof args[1] === 'object' && args[1] !== null) {
			return { message, data: args[1] };
		}

		// Multiple args after message
		return { message, data: args.slice(1).map(serializeValue) };
	}

	// If first arg is Error
	if (args[0] instanceof Error) {
		const err = args[0];
		if (args.length === 1) return { message: err.message, data: serializeValue(err) };
		return { message: err.message, data: args.map(serializeValue) };
	}

	// If first arg is object, use it as data
	if (typeof args[0] === 'object' && args[0] !== null) {
		if (args.length === 1) return { data: args[0] };
		return { data: args.map(serializeValue) };
	}

	// Fallback: wrap all args
	return { data: args.map(serializeValue) };
}

/**
 * Create structured log entry
 */
function createLogEntry(level: LogLevel, args: unknown[]): LogEntry {
	const { message, data } = serializeArgs(args);
	const entry: LogEntry = {
		timestamp: dayjs().format(TIMESTAMP_FORMAT),
		level,
	};

	if (message) entry.message = message;
	if (data !== undefined) {
		if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
			Object.assign(entry, data);
		} else {
			entry.data = data;
		}
	}

	return entry;
}

/**
 * Output log in production format (JSON) or development format (pretty)
 */
function writeLog(level: LogLevel, args: unknown[]): void {
	if (isProd) {
		// Production: structured JSON for log aggregation (CloudWatch, Datadog, etc.)
		const entry = createLogEntry(level, args);
		const json = JSON.stringify(entry);

		// Use appropriate stream based on level
		if (level === 'error' || level === 'warn') {
			const message = args
				.map((arg) => {
					if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
					return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
				})
				.join(' ');
			const trace = args
				.map((arg) => {
					if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
					return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
				})
				.join('\n');

			originalConsole.error(JSON.stringify({ message, trace }));

			// Fire-and-forget: send error to external error logger API
			if (level === 'error') {
				errorLoggerService.send(message, trace);
			}
		} else {
			originalConsole.log(json);
		}
	} else {
		// Development: pretty output with colors
		const prefix = `[${dayjs().format(TIMESTAMP_FORMAT)}] [${level.toUpperCase()}]`;
		switch (level) {
			case 'error':
				originalConsole.error(prefix, ...args);
				break;
			case 'warn':
				originalConsole.warn(prefix, ...args);
				break;
			case 'debug':
				originalConsole.debug(prefix, ...args);
				break;
			default:
				originalConsole.log(prefix, ...args);
		}
	}
}

/**
 * Logger interface for structured logging
 */
export const logger = {
	debug: (...args: unknown[]) => writeLog('debug', args),
	info: (...args: unknown[]) => writeLog('info', args),
	warn: (...args: unknown[]) => writeLog('warn', args),
	error: (...args: unknown[]) => writeLog('error', args),
	log: (...args: unknown[]) => writeLog('info', args),
};

// Override console methods to use structured logging
console.log = (...args) => writeLog('info', args);
console.info = (...args) => writeLog('info', args);
console.warn = (...args) => writeLog('warn', args);
console.error = (...args) => writeLog('error', args);
console.debug = (...args) => writeLog('debug', args);
