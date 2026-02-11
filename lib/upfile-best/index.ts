import justFetch from '@/lib/fetch/justFetch';
import { getFileExtension, getFileNameWithoutExtension } from 'diginext-utils/string';
import mime from 'mime';
import { makeSlug } from 'diginext-utils/makeSlug';
import { v7s } from '@/lib/utils/uuid';
import { v7 } from 'uuid';
import appConfig from '@/config/appConfig';
import type { FetchResponse } from '@/lib/fetch/type';

// ============================================================================
// Types
// ============================================================================

export interface IUpfileBest {
	id: string;
	name: string;
	path: string;
	size: string;
	mimeType: string;
	createdAt: string;
	updatedAt: string;
	storageSpaceId: string;
}

export interface UploadFileOptions {
	file: File;
	fileName?: string;
	dir?: string;
	mimeType?: string;
}

export interface UploadBase64Options {
	base64: string;
	fileName?: string;
	dir?: string;
	mimeType: string;
}

interface UploadRequest {
	buffer: Buffer;
	fileName: string;
	mimeType: string;
	dir?: string;
}

// ============================================================================
// Utilities
// ============================================================================

/** Build a unique safe filename: `{uuid}-{slug}.{ext}` or `{uuid}.{ext}` */
const buildSafeFileName = (originalName: string, mimeType: string): string => {
	const ext = getFileExtension(originalName) || mime.getExtension(mimeType) || 'png';
	const slug = makeSlug(getFileNameWithoutExtension(originalName) || '');
	return slug ? `${v7s()}-${slug}.${ext}` : `${v7()}.${ext}`;
};

const fileToBuffer = async (file: File): Promise<Buffer> => {
	const arrayBuffer = await file.arrayBuffer();
	return Buffer.from(arrayBuffer);
};

const base64ToBuffer = (base64: string): Buffer => {
	const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
	return Buffer.from(base64Data, 'base64');
};

// ============================================================================
// Core
// ============================================================================

const uploadToServer = async ({
	buffer,
	fileName,
	mimeType,
	dir = '',
}: UploadRequest): Promise<FetchResponse<IUpfileBest>> => {
	'use server';

	return await justFetch<IUpfileBest>({
		method: 'POST',
		path: appConfig.upfileBest.getUploadUrl('/api/upload/stream'),
		data: buffer,
		timeout: 1000 * 60 * 10,
		headers: {
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Content-Length': `${buffer.length}`,
			'Content-Type': mimeType,
			'upf-base-dir': appConfig.upfileBest.getUploadDir(dir),
			'token-api': process.env.UPFILE_BEST_TOKEN_API!,
		},
	});
};

// ============================================================================
// Public API
// ============================================================================

export const uploadByBase64 = async ({
	base64,
	fileName,
	dir = '',
	mimeType,
}: UploadBase64Options): Promise<FetchResponse<IUpfileBest> | undefined> => {
	'use server';

	try {
		const buffer = base64ToBuffer(base64);
		const safeFileName = buildSafeFileName(fileName || '', mimeType);

		return await uploadToServer({ buffer, fileName: safeFileName, mimeType, dir });
	} catch (error) {
		console.error('[uploadByBase64] Upload failed:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			fileName,
			dir,
		});
		return undefined;
	}
};

export const uploadByFile = async ({
	file,
	fileName,
	dir = '',
	mimeType,
}: UploadFileOptions): Promise<FetchResponse<IUpfileBest> | undefined> => {
	'use server';

	try {
		const resolvedMimeType = mimeType || file.type;
		const safeFileName = buildSafeFileName(fileName || file.name, resolvedMimeType);

		// Convert File to Buffer to ensure we have actual size
		// This handles cases where Content-Length is stripped by proxies (like Cloudflare)
		const buffer = await fileToBuffer(file);
		return await uploadToServer({ buffer, fileName: safeFileName, mimeType: resolvedMimeType, dir });
	} catch (error) {
		console.error('[uploadByFile] Upload failed:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			fileName: file.name,
			fileSize: file.size,
			dir,
		});
		return undefined;
	}
};
