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
