import { Prisma, PrismaClient } from '@prisma/client';

declare global {
	// eslint-disable-next-line no-var
	var cachedPrisma: PrismaClient | undefined;
}

// ============================================
// Configuration
// ============================================
const DB_CONFIG = {
	// Connection pool settings - adjust based on your DB server limits
	// Formula: (number of server instances) × connectionLimit < DB max_connections
	connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '50', 10),
	poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '10', 10),

	// Retry settings for connection failures
	maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),
	retryDelayMs: parseInt(process.env.DB_RETRY_DELAY_MS || '1000', 10),

	// Idle connection management
	idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '10', 10),
};

const isProduction = process.env.ENV === 'production';

// ============================================
// Build connection URL with pool settings
// ============================================
function buildConnectionUrl(): string | undefined {
	const baseUrl = process.env.DATABASE_URL;
	if (!baseUrl) return undefined;

	const poolParams = new URLSearchParams({
		connection_limit: DB_CONFIG.connectionLimit.toString(),
		pool_timeout: DB_CONFIG.poolTimeout.toString(),
	});

	// Add idle timeout for serverless/edge environments (optional)
	if (process.env.DB_IDLE_TIMEOUT) {
		poolParams.set('idle_timeout', DB_CONFIG.idleTimeout.toString());
	}

	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}${poolParams.toString()}`;
}

// ============================================
// Prisma client options
// ============================================
const prismaClientOptions: Prisma.PrismaClientOptions = {
	log: isProduction
		? (['error', 'warn'] as Prisma.LogLevel[])
		: ([
				{ level: 'query', emit: 'event' },
				{ level: 'error', emit: 'stdout' },
				{ level: 'info', emit: 'stdout' },
				{ level: 'warn', emit: 'stdout' },
			] as Prisma.LogDefinition[]),
	datasources: {
		db: {
			url: buildConnectionUrl(),
		},
	},
};

// ============================================
// Retry utility with exponential backoff
// ============================================
async function withRetry<T>(
	operation: () => Promise<T>,
	operationName: string,
	maxRetries = DB_CONFIG.maxRetries
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			const isLastAttempt = attempt === maxRetries;

			if (isLastAttempt) {
				console.error(`[DB] ${operationName} failed after ${maxRetries} attempts:`, lastError.message);
				throw lastError;
			}

			const delay = DB_CONFIG.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
			console.warn(`[DB] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`);
			await Bun.sleep(delay);
		}
	}

	throw lastError;
}

// ============================================
// Create and connect Prisma client
// ============================================
async function createPrismaClient(): Promise<PrismaClient> {
	const client = new PrismaClient(prismaClientOptions);

	// Verify connection with retry
	await withRetry(
		async () => {
			await client.$connect();
			// Verify with a simple query
			await client.$executeRawUnsafe('SELECT 1');
		},
		'Database connection',
		DB_CONFIG.maxRetries
	);

	console.log(
		`[DB] Connected successfully (pool: ${DB_CONFIG.connectionLimit}, timeout: ${DB_CONFIG.poolTimeout}s)`
	);

	return client;
}

// ============================================
// Graceful shutdown handler
// ============================================
let isShuttingDown = false;

function setupShutdownHandler(client: PrismaClient): void {
	const shutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;

		console.log(`[DB] Received ${signal}, disconnecting...`);

		try {
			await client.$disconnect();
			console.log('[DB] Disconnected successfully');
		} catch (error) {
			console.error('[DB] Error during disconnect:', error);
		}

		process.exit(0);
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================
// Health check
// ============================================
export async function checkDbHealth(): Promise<{ healthy: boolean; latencyMs: number }> {
	const start = performance.now();
	try {
		await db.$executeRawUnsafe('SELECT 1');
		return {
			healthy: true,
			latencyMs: Math.round(performance.now() - start),
		};
	} catch {
		return {
			healthy: false,
			latencyMs: Math.round(performance.now() - start),
		};
	}
}

// ============================================
// Initialize database
// ============================================
let dbInstance: PrismaClient | null = null;
let initPromise: Promise<PrismaClient> | null = null;

export async function initDb(): Promise<PrismaClient> {
	// Return cached instance
	if (global.cachedPrisma) {
		return global.cachedPrisma;
	}

	if (dbInstance) {
		return dbInstance;
	}

	// Prevent multiple simultaneous initialization attempts
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		try {
			const client = await createPrismaClient();
			setupShutdownHandler(client);

			// Cache globally to survive hot reloads in development
			global.cachedPrisma = client;
			dbInstance = client;

			return client;
		} catch (error) {
			console.error('[DB] Initialization failed:', error);
			initPromise = null; // Allow retry on next call
			throw error;
		}
	})();

	return initPromise;
}

// ============================================
// Synchronous db export (lazy proxy)
// ============================================
// This creates a proxy that forwards all calls to the initialized client
// Allows `import { db }` to work synchronously while initialization is async
const dbProxy = new Proxy({} as PrismaClient, {
	get(_, prop: string | symbol) {
		if (!dbInstance && !global.cachedPrisma) {
			throw new Error(
				'[DB] Database not initialized. Call `await initDb()` before using `db`.'
			);
		}
		const client = dbInstance || global.cachedPrisma!;
		const value = client[prop as keyof PrismaClient];
		if (typeof value === 'function') {
			return value.bind(client);
		}
		return value;
	},
});

export const db: PrismaClient = dbProxy;

// ============================================
// Export config for external use
// ============================================
export const dbConfig = DB_CONFIG;
