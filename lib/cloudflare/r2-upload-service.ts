import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import appConfig from '@/config/appConfig';
import { logger } from '@/lib/logger';

// Lazy-initialized S3 client (avoids crash if env vars missing on API pods)
let s3Client: S3Client | null = null;

function getClient(): S3Client {
	if (!s3Client) {
		s3Client = new S3Client({
			region: 'auto',
			endpoint: `https://${appConfig.cloudflare.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: appConfig.cloudflare.accessKeyId,
				secretAccessKey: appConfig.cloudflare.secretAccessKey,
			},
			forcePathStyle: true,
		});
	}
	return s3Client;
}

export interface R2UploadResult {
	key: string;
	url: string;
	size: number;
}

/**
 * Upload a buffer to Cloudflare R2 and return the public URL.
 */
export async function uploadToR2(
	buffer: Buffer,
	key: string,
	contentType: string = 'application/octet-stream'
): Promise<R2UploadResult> {
	const client = getClient();

	await client.send(
		new PutObjectCommand({
			Bucket: appConfig.cloudflare.bucketName,
			Key: key,
			Body: buffer,
			ContentType: contentType,
			CacheControl: 'max-age=31536000',
		})
	);

	const url = `${appConfig.cloudflare.publicUrl}/${key}`;
	logger.info({ key, size: buffer.length }, '[r2] Upload complete');

	return { key, url, size: buffer.length };
}
