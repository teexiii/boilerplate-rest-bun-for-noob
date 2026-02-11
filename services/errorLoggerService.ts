import env from '@/config/env';
import crypto from 'crypto';
import pkg from '@/package.json';
import { v4 } from 'uuid';
import justFetch from '@/lib/fetch/justFetch';

// ─── Config (lazy-loaded to avoid env issues at import time) ───

let _apiUrl: string | undefined;

function getApiUrl() {
	if (!_apiUrl) _apiUrl = env('ERROR_LOGGER_API', true);
	return _apiUrl;
}

// Same logic as lib/security/hash.ts but uses ERROR_LOGGER_HASH_SECRET
const addPepper = (text: string | number) => {
	return `${text}${env('ERROR_LOGGER_HASH_SECRET', false)}`;
};

function makeHash(text: string | number) {
	return crypto.createHash('md5').update(addPepper(text)).digest('hex');
}

function generateHash() {
	const nonce = v4();
	return `${nonce}.${makeHash(nonce)}`;
}

// ─── Types ──────────────────────────────────────────────────

export interface ErrorLogCreateInput {
	message: string;
	trace: string;
	project: string;
}

// ─── Service ────────────────────────────────────────────────

export const errorLoggerService = {
	/**
	 * Send a single error log to the external error logger API.
	 * Fire-and-forget — never throws.
	 */
	async send(message: string, trace: string): Promise<void> {
		try {
			const apiUrl = getApiUrl();
			if (!apiUrl) return; // Not configured, skip silently

			const body: ErrorLogCreateInput = { message, trace, project: pkg.name };
			const payload = JSON.stringify(body);
			const hash = generateHash();

			await justFetch({
				path: `${apiUrl}/api/error-logs`,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					hash,
				},
				data: payload,
			});
		} catch {
			// Silently fail — we can't log errors about logging errors
		}
	},

	/**
	 * Send multiple error logs in a single batch request.
	 * Fire-and-forget — never throws.
	 */
	async sendBatch(logs: Array<{ message: string; trace: string }>): Promise<void> {
		try {
			const apiUrl = getApiUrl();
			if (!apiUrl) return;

			const body = logs.map((log) => ({
				message: log.message,
				trace: log.trace,
				project: pkg.name,
			}));
			const payload = JSON.stringify(body);
			const hash = generateHash();

			await fetch(`${apiUrl}/api/error-logs/batch`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					hash,
				},
				body: payload,
			});
		} catch {
			// Silently fail
		}
	},
};
