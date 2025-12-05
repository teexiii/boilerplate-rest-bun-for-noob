// Export all types
export * from './auth';
export * from './role';
export * from './socialAuth';

/**
 * Generic validator class factory that creates runtime validators for TypeScript interfaces
 */
export function createInterfaceValidator<T extends object>(template: T) {
	return class Validator {
		constructor() {
			// Copy all properties from the template
			Object.assign(this, template);
		}

		/**
		 * Get all keys from the interface (template properties)
		 */
		static getKeys(): string[] {
			return Object.keys(template);
		}

		/**
		 * Validate that the provided data only contains keys defined in the interface
		 * @param data Data to validate
		 * @returns Validated and typed data
		 */
		static validate(data: unknown): T {
			if (typeof data !== 'object' || data === null) {
				throw new Error('Input must be an object');
			}

			const allowedKeys = this.getKeys();
			const dataKeys = Object.keys(data as object);
			dataKeys.filter((key) => !allowedKeys.includes(key)).forEach((key) => delete (data as any)[key]);

			return data as T;
		}
	};
}

// Generic update function that works with any interface
export async function updateEntity<T extends object>(
	id: string,
	data: unknown,
	validator: { validate: (data: unknown) => T },
	updateFn: (id: string, data: T) => Promise<any>
) {
	const validData = validator.validate(data);
	return updateFn(id, validData);
}

// Generic update function that works with any interface
export function entity<T extends object>(data: unknown, validator: { validate: (data: unknown) => T }) {
	return validator.validate(data);
}

// // Alternative implementation with a simpler interface
// export function validateInterface<T extends object>(data: unknown, template: T): T {
//     if (typeof data !== "object" || data === null) {
//         throw new Error("Input must be an object");
//     }

//     const allowedKeys = Object.keys(template);
//     const dataKeys = Object.keys(data as object);
//     dataKeys.filter((key) => !allowedKeys.includes(key)).forEach((key) => delete (data as any)[key]);

//     return data as T;
// }
