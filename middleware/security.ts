import { fail } from '@/lib/response';
import { makeHash } from '@/lib/security/hash';
import { redis } from '@/caching/redis';
import crypto from 'crypto';
import type { AuthenticatedRequest, RouteParams } from '@/types/auth';
import { toInt } from 'diginext-utils/object';
import { isLocal } from '@/config';

const SECURITY_CACHE_PREFIX = 'security:nonce';
const DURATION_CACHE = toInt(process.env.DURATION_CACHE_HASH_SECOND) || 1800;

export async function requireHash(req: AuthenticatedRequest, params: RouteParams): Promise<Response | null> {
	if (process.env.NODE_ENV == 'test') return null;
	if (isLocal) return null;

	const hih = req.headers.get('hash');
	if (!hih) {
		return fail('Missing Signature', 406);
	}

	const [uuid, providedHash] = hih.split('.');
	if (!uuid || !providedHash) {
		return fail('Invalid Format', 406);
	}

	const expectedHash = makeHash(uuid);

	const hashBuffer = Buffer.from(providedHash, 'utf8');
	const expectedBuffer = Buffer.from(expectedHash, 'utf8');

	if (
		hashBuffer.length !== expectedBuffer.length ||
		!crypto.timingSafeEqual(new Uint8Array(hashBuffer), new Uint8Array(expectedBuffer))
	) {
		return fail('Invalid Signature', 406);
	}

	const cacheKey = `${SECURITY_CACHE_PREFIX}:${uuid}`;

	const wasSet = await redis.setNX(cacheKey, true, DURATION_CACHE);

	if (!wasSet) {
		return fail('Duplicate Request', 409); // 409 Conflict is better for replays
	}

	return null;
}
