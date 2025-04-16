import { fail, fail400 } from '@/lib/response';
import { makeHash } from '@/lib/security/hash';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';

const cache = new Map();

export async function requireHash(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	const hih = req.headers.get('hash');

	if (!hih) return fail('Not Acceptable', 406);

	const [uuid, hash] = hih.split('.');
	if (!uuid || !hash) return fail('Not Acceptable', 406);

	if (cache.has(uuid)) return fail('Not Acceptable', 406);

	if (makeHash(uuid) != hash) return fail('Not Acceptable', 406);

	cache.set(uuid, true);

	return null; // Continue to next middleware/handler
}
