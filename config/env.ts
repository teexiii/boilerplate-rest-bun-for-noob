export default function env(key: string, optional = true, defaultValue?: any) {
	try {
		if (!optional)
			if (typeof process.env[key] === 'undefined') {
				throw new Error(`Environment variable ${key} is required`);
			}
		return typeof process.env[key] === 'undefined' ? defaultValue : process.env[key]!;
	} catch (error) {
		throw new Error(`Failed to get environment variable: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
