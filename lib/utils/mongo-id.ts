// /**
//  * Validates if a string is a valid MongoDB ObjectId
//  */
// export function isValidObjectId(id: string): boolean {
// 	return /^[0-9a-fA-F]{24}$/.test(id);
// }

// /**
//  * Formats and validates MongoDB ObjectId
//  * @throws Error if ID is invalid
//  */
// export function formatObjectId(id: string): string {
// 	if (!isValidObjectId(id)) {
// 		throw new Error('Invalid MongoDB ObjectId format', { cause: 400 });
// 	}
// 	return id;
// }

// /**
//  * Safely tries to format an ID, returns null if invalid
//  */
// export function tryFormatObjectId(id: string): string | null {
// 	return isValidObjectId(id) ? id : null;
// }
