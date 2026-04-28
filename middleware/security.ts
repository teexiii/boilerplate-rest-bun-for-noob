import { fail } from '@/lib/response';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import { isLocal } from '@/config';

const API_KEY = process.env.HASH_SECRET || '';

export async function requireHash(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	if (process.env.NODE_ENV == 'test') return null;
	if (isLocal) return null;

	const key = req.headers.get('hash');
	if (key !== API_KEY) {
		return fail('Invalid Signature', 406);
	}

	return null;
}
