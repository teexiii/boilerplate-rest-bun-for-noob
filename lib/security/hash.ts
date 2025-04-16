import env from '@/config/env';
import crypto, { randomUUID } from 'crypto';

const addPepper = (text: string | number) => {
	return `${text}${env('HASH_SECRET', false)}`;
};

export function makeHash(text: string | number) {
	//
	try {
		return crypto.createHash('md5').update(addPepper(text)).digest('hex');
	} catch (error) {
		throw new Error(`makeHash failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export function generateHash() {
	//
	try {
		const uuid = randomUUID();
		return `${uuid}.${makeHash(uuid)}`;
	} catch (error) {
		throw new Error(`generateHash failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
