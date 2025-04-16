/**
 * Try to start a server on the preferred port, fallback to others if needed
 */
export async function findAvailablePort(preferredPort: number): Promise<number> {
	// Try the preferred port first
	try {
		const testServer = Bun.serve({
			port: preferredPort,
			fetch: () => new Response('Port test'),
		});

		// If we get here, the port is available
		testServer.stop();
		return preferredPort;
	} catch (err) {
		console.log(`Port ${preferredPort} unavailable, trying alternatives...`);
	}

	// Try ports in a range (preferredPort+1 to preferredPort+20)
	for (let port = preferredPort + 1; port < preferredPort + 20; port++) {
		try {
			const testServer = Bun.serve({
				port,
				fetch: () => new Response('Port test'),
			});

			// Port is available
			testServer.stop();
			return port;
		} catch (err) {
			// Continue to next port
		}
	}

	// If all else fails, let the OS choose a port
	try {
		const testServer = Bun.serve({
			port: 0, // OS will assign an available port
			fetch: () => new Response('Port test'),
		});

		const port = testServer.port;
		testServer.stop();

		if (!port) throw new Error("can't find");

		return port;
	} catch (err) {
		throw new Error('Failed to find an available port');
	}
}
