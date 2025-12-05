import appConfig from '@/config/appConfig';
import justFetch from '@/lib/fetch/justFetch';
import type { FetchResponse } from '@/lib/fetch/type';
import { isValidUUID } from '@/lib/utils/uuid';
import { makeSlug } from 'diginext-utils/dist/Slug';
import { randomFileName } from 'diginext-utils/dist/string/random';
import { getExtensionFromMimeType, getFileNameWithoutExtension } from 'diginext-utils/dist/string/url';

/**
 * Response structure from Upfile Best API
 */
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

/**
 * Upload options for file uploads
 */
export interface UploadFileOptions {
	file: File;
	fileName?: string;
	dir?: string;
	mimeType?: string;
}

/**
 * Upload options for base64 uploads
 */
export interface UploadBase64Options {
	base64: string;
	fileName?: string;
	dir?: string;
	mimeType: string;
}

/**
 * Internal upload request options
 */
interface UploadRequest {
	buffer: Buffer;
	fileName: string;
	mimeType: string;
	dir?: string;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generates a safe, unique filename
 * @param originalName - Original filename (can be empty)
 * @param mimeType - MIME type of the file
 * @returns Generated filename with extension
 */
const generateSafeFileName = (originalName: string, mimeType: string): string => {
	const ext = getExtensionFromMimeType(mimeType);

	if (!originalName) {
		return `${randomFileName(makeSlug(process.env.TITLE || 'file'), 4)}.${ext}`;
	}

	const fileNameWithoutExt = getFileNameWithoutExtension(originalName);
	const isUuid = isValidUUID(fileNameWithoutExt);

	if (isUuid) {
		return `${fileNameWithoutExt}.${ext || 'png'}`;
	}

	const safeName = randomFileName(makeSlug(fileNameWithoutExt), 4);
	return `${safeName}.${ext || 'png'}`;
};

/**
 * Converts a File to Buffer and calculates its size
 * This is necessary because proxies like Cloudflare strip Content-Length headers
 * @param file - File object to convert
 * @returns Buffer with actual size
 */
const fileToBuffer = async (file: File): Promise<Buffer> => {
	const arrayBuffer = await file.arrayBuffer();
	return Buffer.from(arrayBuffer);
};

/**
 * Decodes base64 string to Buffer
 * @param base64 - Base64 encoded string (with or without data URL prefix)
 * @returns Buffer containing decoded data
 */
const base64ToBuffer = (base64: string): Buffer => {
	const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
	return Buffer.from(base64Data, 'base64');
};

// ============================================================================
// Core Upload Logic
// ============================================================================

/**
 * Low-level upload function that sends data to Upfile Best API
 * @param request - Upload request with buffer and metadata
 * @returns Upload response from API
 */
const uploadToServer = async ({
	buffer,
	fileName,
	mimeType,
	dir = '',
}: UploadRequest): Promise<FetchResponse<IUpfileBest>> => {
	'use server';

	const actualSize = buffer.length;

	return await justFetch<IUpfileBest>({
		method: 'POST',
		path: appConfig.upfileBest.getUploadUrl('/api/upload/stream'),
		data: buffer,
		timeout: 1000 * 60 * 10,
		headers: {
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Content-Length': `${actualSize}`,
			'Content-Type': mimeType,
			'upf-base-dir': appConfig.upfileBest.getUploadDir(dir),
			'token-api': process.env.UPFILE_BEST_TOKEN_API!,
		},
	});
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Uploads a file from base64 string
 * @param options - Base64 upload options
 * @returns Upload response or undefined on error
 *
 * @example
 * ```ts
 * const result = await uploadByBase64({
 *   base64: 'data:image/png;base64,iVBORw0KG...',
 *   fileName: 'avatar.png',
 *   mimeType: 'image/png',
 *   dir: 'avatars'
 * });
 * ```
 */
export const uploadByBase64 = async ({
	base64,
	fileName,
	dir = '',
	mimeType,
}: UploadBase64Options): Promise<FetchResponse<IUpfileBest> | undefined> => {
	'use server';

	try {
		const buffer = base64ToBuffer(base64);
		const safeFileName = fileName || generateSafeFileName('', mimeType);

		return await uploadToServer({
			buffer,
			fileName: safeFileName,
			mimeType,
			dir,
		});
	} catch (error) {
		console.error('[uploadByBase64] Upload failed:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			fileName,
			dir,
		});
		return undefined;
	}
};

/**
 * Uploads a File object
 * @param options - File upload options
 * @returns Upload response or undefined on error
 *
 * @example
 * ```ts
 * const result = await uploadByFile({
 *   file: fileFromInput,
 *   fileName: 'custom-name.jpg', // Optional
 *   dir: 'uploads/images',
 *   mimeType: 'image/jpeg' // Optional, will use file.type if not provided
 * });
 * ```
 */
export const uploadByFile = async ({
	file,
	fileName,
	dir = '',
	mimeType,
}: UploadFileOptions): Promise<FetchResponse<IUpfileBest> | undefined> => {
	'use server';

	try {
		const resolvedMimeType = mimeType || file.type;
		const safeFileName = fileName || generateSafeFileName(file.name, resolvedMimeType);

		// Convert File to Buffer to ensure we have actual size
		// This handles cases where Content-Length is stripped by proxies (like Cloudflare)
		const buffer = await fileToBuffer(file);
		return await uploadToServer({
			buffer,
			fileName: safeFileName,
			mimeType: resolvedMimeType,
			dir,
		});
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
