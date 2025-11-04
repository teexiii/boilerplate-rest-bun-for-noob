/**
 * Validate UUID format (UUIDv4 or UUIDv7)
 */
export const isValidUUID = (id: string): boolean => {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return uuidRegex.test(id);
};

/**
 * Generate a shortened UUID v7 (48-bit / 6 bytes)
 * Returns a base64url-encoded string representing the first 48 bits of a UUID v7
 * This maintains time-ordering while being more compact than full UUIDs
 */
export const v7s = (): string => {
	const buf = Buffer.alloc(3);
	let offset = 0;

	// Get current timestamp in milliseconds
	const msecs = Date.now();

	// Use a sequence counter with random initialization
	const seq = Math.floor(Math.random() * 0x3fffffff);

	// // Timestamp (lower 24 bits of milliseconds)
	buf[offset++] = (msecs / 0x10000000) & 0xff;
	// buf[offset++] = (msecs / 0x10) & 0xff;
	// buf[offset++] = msecs & 0xff;

	// // // Version 7 (4 bits) + sequence high bits
	// buf[offset++] = 0x70 | ((seq >>> 28) & 0x0f);

	// Sequence middle bits
	buf[offset++] = (seq >>> 20) & 0xff;

	// Variant (10b) + sequence low bits
	buf[offset++] = 0x80 | ((seq >>> 14) & 0x3f);

	// Convert to base64url (URL-safe, no padding)
	return buf.toString('base64url').replace(/-/g, 'a').replace(/_/g, 'b').toLowerCase();
};

// for (let i = 0; i < 100000000; i++) {
// 	console.log(v7s());
// }
