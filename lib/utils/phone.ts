/**
 * Normalize phone number: convert +84 prefix to 0 (Vietnam format)
 * Examples: +84901234567 → 0901234567, 84901234567 → 0901234567
 */
export function normalizePhone(phone: string): string {
	let normalized = phone.trim();
	if (normalized.startsWith('+84')) {
		normalized = '0' + normalized.slice(3);
	} else if (normalized.startsWith('84') && normalized.length > 9) {
		normalized = '0' + normalized.slice(2);
	}
	return normalized;
}
