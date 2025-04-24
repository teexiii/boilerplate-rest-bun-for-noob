import { Prisma, PrismaClient } from '@prisma/client';

declare global {
	// eslint-disable-next-line no-var
	var cachedPrisma: PrismaClient | undefined;
}

const prismaClientOptions: Prisma.PrismaClientOptions = {
	log:
		process.env.ENV !== 'production'
			? ([
					{ level: 'query', emit: 'event' },
					{ level: 'error', emit: 'stdout' },
					{ level: 'info', emit: 'stdout' },
					{ level: 'warn', emit: 'stdout' },
				] as Prisma.LogDefinition[])
			: (['error'] as Prisma.LogLevel[]),
};

export function createPrismaClient() {
	const client = new PrismaClient(prismaClientOptions);
	(async () => {
		// Test the database connection
		try {
			// Simple query to test connection
			await client.$executeRawUnsafe('SELECT 1');
			console.log('Database connection established successfully');
		} catch (error) {
			console.error('Failed to connect to the database:', error);
			process.exit(1); // Exit with error code if connection fails
		}

		// Soft shutdown
		['SIGINT', 'SIGTERM'].forEach((signal) => {
			process.on(signal, async () => {
				console.log('Gracefully shutting down Prisma Client...');
				await client.$disconnect();
				process.exit(0);
			});
		});
	})();

	return client;
}

// Initialize database connection with error handling
export const initDb = () => {
	try {
		// Prevent multiple instances of Prisma Client in development
		const client = global.cachedPrisma || createPrismaClient();

		if (process.env.ENV !== 'production') {
			global.cachedPrisma = client;
		}

		return client;
	} catch (error) {
		console.error('Database initialization failed:', error);
		process.exit(1);
	}
};

// For backward compatibility and simpler imports
export const db: PrismaClient = initDb();
