import { queue, type QueueObject } from 'async';

/**
 * Check if all values in an object are null
 */
function isAllNull(obj: Record<string, any>): boolean {
	for (const value of Object.values(obj)) {
		if (value !== null) {
			// If it's a nested object, recursively check
			if (
				typeof value === 'object' &&
				value !== null &&
				(!Array.isArray(value) || (Array.isArray(value) && !value.length))
			) {
				if (!isAllNull(value)) return false;
			} else {
				return false;
			}
		}
	}
	return true;
}

/**
 * Recursively nullify nested objects where all values are null
 */
function nullifyEmptyObjects(obj: Record<string, any>): Record<string, any> {
	for (const [key, value] of Object.entries(obj)) {
		if (value instanceof Date) continue;
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			if (isAllNull(value)) {
				obj[key] = null;
			} else {
				nullifyEmptyObjects(value);
			}
		}
	}
	return obj;
}

export function nestFlatObject<T = any>(flatObj: Record<string, any>): T {
	const result: any = {};

	for (const [key, value] of Object.entries(flatObj)) {
		if (key.includes('.')) {
			// Handle nested keys like "genre.id" or "vibe.name"
			const parts = key.split('.');
			let current = result;

			for (let i = 0; i < parts.length - 1; i++) {
				const part = parts[i];
				if (!current[part]) {
					current[part] = {};
				}
				current = current[part];
			}

			current[parts[parts.length - 1]] = value;
		} else {
			// Handle top-level keys
			result[key] = value;
		}
	}

	// Nullify nested objects where all values are null (e.g., when LEFT JOIN finds no match)
	nullifyEmptyObjects(result);

	return result as T;
}

// ============================================
// Background Task Queue (Fire-and-Forget)
// ============================================

interface BackgroundTask {
	name: string;
	fn: () => Promise<void>;
}

/**
 * Queue for fire-and-forget background tasks
 * Use for: cache invalidation, logging, analytics, push notifications
 * DO NOT use for: operations where you need the result
 */
export const backgroundQueue: QueueObject<BackgroundTask> = queue(async (task: BackgroundTask) => {
	try {
		await task.fn();
	} catch (error) {
		console.error(`[BackgroundQueue] Task "${task.name}" failed:`, error);
	}
}, 50); // Concurrency of 50

/**
 * Add a fire-and-forget task to the background queue
 */
export function queueBackgroundTask(name: string, fn: () => Promise<void>): void {
	backgroundQueue.push({ name, fn });
}

// ============================================
// Rate-Limited Write Queue (Optional)
// ============================================

interface WriteTask<T> {
	fn: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
}

/**
 * Rate-limited queue for DB writes
 * Returns a Promise so you still get the result
 * Use when you need to limit concurrent writes but still need results
 */
export const writeQueue: QueueObject<WriteTask<any>> = queue(async (task: WriteTask<any>) => {
	try {
		const result = await task.fn();
		task.resolve(result);
	} catch (error) {
		task.reject(error as Error);
	}
}, 20); // Lower concurrency for writes

/**
 * Execute a write operation through the rate-limited queue
 * Still returns the result, just rate-limited
 */
export function queueWrite<T>(fn: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		writeQueue.push({ fn, resolve, reject });
	});
}
