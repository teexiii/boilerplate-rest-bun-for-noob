/**
 * Convert a time string (e.g. "30d", "1h", "15m") to milliseconds
 */
export function timeToMs(timeStr: string): number {
	const match = timeStr.match(/^(\d+)([smhdwy])$/);
	if (!match) {
		throw new Error(`Invalid time string: ${timeStr}`, { cause: 400 });
	}

	const [, valueStr, unit] = match;
	const value = parseInt(valueStr, 10);

	const unitToMs: Record<string, number> = {
		s: 1000, // seconds
		m: 1000 * 60, // minutes
		h: 1000 * 60 * 60, // hours
		d: 1000 * 60 * 60 * 24, // days
		w: 1000 * 60 * 60 * 24 * 7, // weeks
		y: 1000 * 60 * 60 * 24 * 365, // years (approximate)
	};

	return value * unitToMs[unit];
}
