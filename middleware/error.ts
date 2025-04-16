import { fail400, fail } from '@/lib/response';

export async function errorHandler<Args extends any[], Return>(fn: (...args: Args) => Promise<Return> | Return) {
	return async (...args: Args): Promise<Return | Response> => {
		try {
			return await fn(...args);
		} catch (error: any) {
			console.error('Error:', error);

			if (typeof error?.cause != 'undefined')
				return fail(`${error instanceof Error ? error.message : 'Unknown error'}`, error?.cause);

			if (typeof error?.code != 'undefined')
				if (error.code) {
					// Handle Prisma errors
					if (error.code === 'P2002') {
						return fail('Unique constraint failed: ' + error.meta?.target, 409);
					}
					if (error.code === 'P2025') {
						return fail('Record not found', 404);
					}
				}

			// Default error response
			return fail('Internal server error', 500);
		}
	};
}

/**
 * Validation middleware
 */
export function validate<T>(schema: any) {
	return async function (req: Request): Promise<Response | null> {
		try {
			const body = await req.json();

			try {
				// Parse and validate the body
				const validatedData = schema.parse(body);

				// Replace the request body with the validated data
				// This requires a workaround since Request is readonly
				Object.defineProperty(req, 'validatedBody', {
					value: validatedData,
					writable: false,
				});

				return null; // Continue to next middleware/handler
			} catch (error) {
				return fail(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, 400);
			}
		} catch (error) {
			return fail('Invalid JSON', 400);
		}
	};
}
