// import appConfig from '@/config/appConfig';
// /**
//  * Cloudflare R2 Upload Helper
//  * Supports both browser and Node.js environments
//  */

// // ============================================================================
// // TYPES
// // ============================================================================

// export interface R2UploadConfig {
// 	accountId: string;
// 	accessKeyId: string;
// 	secretAccessKey: string;
// 	bucketName: string;
// 	region?: string; // Default: 'auto'
// }

// export interface UploadOptions {
// 	/** Custom file path/key in the bucket */
// 	key?: string;
// 	/** Content type (auto-detected if not provided) */
// 	contentType?: string;
// 	/** Custom metadata */
// 	metadata?: Record<string, string>;
// 	/** Cache control header */
// 	cacheControl?: string;
// 	/** Make file publicly accessible */
// 	public?: boolean;
// 	/** Upload progress callback */
// 	onProgress?: (progress: number) => void;
// }

// export interface UploadResult {
// 	success: boolean;
// 	key: string;
// 	url: string;
// 	etag?: string;
// 	size: number;
// 	error?: string;
// }

// // ============================================================================
// // BROWSER UPLOAD (Direct to R2 via S3-compatible API)
// // ============================================================================

// /**
//  * Upload file from browser using presigned URL or direct upload
//  * This requires CORS to be configured on your R2 bucket
//  */
// export class R2BrowserUploader {
// 	private config: R2UploadConfig = appConfig.cloudflare;
// 	private endpoint: string;

// 	constructor(config?: R2UploadConfig) {
// 		if (config) this.config = config;
// 		const region = this.config.region || 'auto';
// 		this.endpoint = `https://${this.config.accountId}.r2.cloudflarestorage.com`;
// 	}

// 	/**
// 	 * Upload file directly from browser
// 	 */
// 	async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
// 		try {
// 			const key = options.key || this.generateKey(file.name);
// 			const contentType = options.contentType || file.type || 'application/octet-stream';

// 			// Create the upload URL
// 			const url = `${this.endpoint}/${this.config.bucketName}/${key}`;

// 			// Create headers
// 			const headers = await this.createHeaders('PUT', key, contentType, options);

// 			// Upload using XMLHttpRequest for progress tracking
// 			const result = await this.uploadWithProgress(url, file, headers, options.onProgress);

// 			return {
// 				success: true,
// 				key,
// 				url: this.getPublicUrl(key),
// 				etag: result.etag,
// 				size: file.size,
// 			};
// 		} catch (error) {
// 			return {
// 				success: false,
// 				key: options.key || '',
// 				url: '',
// 				size: 0,
// 				error: error instanceof Error ? error.message : 'Upload failed',
// 			};
// 		}
// 	}

// 	/**
// 	 * Upload with progress tracking
// 	 */
// 	private uploadWithProgress(
// 		url: string,
// 		file: File,
// 		headers: Record<string, string>,
// 		onProgress?: (progress: number) => void
// 	): Promise<{ etag: string }> {
// 		return new Promise((resolve, reject) => {
// 			const xhr = new XMLHttpRequest();

// 			xhr.upload.addEventListener('progress', (e) => {
// 				if (e.lengthComputable && onProgress) {
// 					const progress = (e.loaded / e.total) * 100;
// 					onProgress(progress);
// 				}
// 			});

// 			xhr.addEventListener('load', () => {
// 				if (xhr.status >= 200 && xhr.status < 300) {
// 					const etag = xhr.getResponseHeader('ETag') || '';
// 					resolve({ etag: etag.replace(/"/g, '') });
// 				} else {
// 					reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
// 				}
// 			});

// 			xhr.addEventListener('error', () => {
// 				reject(new Error('Network error during upload'));
// 			});

// 			xhr.open('PUT', url);
// 			Object.entries(headers).forEach(([key, value]) => {
// 				xhr.setRequestHeader(key, value);
// 			});

// 			xhr.send(file);
// 		});
// 	}

// 	/**
// 	 * Create AWS Signature V4 headers
// 	 */
// 	private async createHeaders(
// 		method: string,
// 		key: string,
// 		contentType: string,
// 		options: UploadOptions
// 	): Promise<Record<string, string>> {
// 		const headers: Record<string, string> = {
// 			'Content-Type': contentType,
// 		};

// 		if (options.cacheControl) {
// 			headers['Cache-Control'] = options.cacheControl;
// 		}

// 		if (options.metadata) {
// 			Object.entries(options.metadata).forEach(([k, v]) => {
// 				headers[`x-amz-meta-${k}`] = v;
// 			});
// 		}

// 		// Note: For production, you should generate presigned URLs on your server
// 		// This is a simplified example showing the headers structure
// 		headers['x-amz-date'] = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

// 		return headers;
// 	}

// 	/**
// 	 * Get public URL for uploaded file
// 	 */
// 	private getPublicUrl(key: string): string {
// 		return appConfig.cloudflare.getPublicUrl(key);

// 		// 	// Use your custom domain from Cloudflare R2
// 		// 	return `/${key}`;
// 		// 	// Or use the R2.dev URL if public access is enabled
// 		// 	// return `https://pub-${this.config.accountId}.r2.dev/${key}`;
// 	}

// 	/**
// 	 * Generate unique key for file
// 	 */
// 	private generateKey(filename: string): string {
// 		const timestamp = Date.now();
// 		const random = Math.random().toString(36).substring(2, 8);
// 		const ext = filename.split('.').pop();
// 		return `uploads/${timestamp}-${random}/${filename}`;
// 	}
// }

// // ============================================================================
// // SERVER-SIDE UPLOAD (Node.js with AWS SDK)
// // ============================================================================

// /**
//  * Server-side uploader using AWS SDK v3
//  * Install: npm install @aws-sdk/client-s3
//  */
// export class R2ServerUploader {
// 	private config: R2UploadConfig = appConfig.cloudflare;
// 	private endpoint: string;

// 	constructor(config?: R2UploadConfig) {
// 		if (config) this.config = config;
// 		this.endpoint = `https://${this.config.accountId}.r2.cloudflarestorage.com`;
// 	}
// 	//https://009dc0fcd0da3e503fbf38eb2b586e4b.r2.cloudflarestorage.com
// 	/**
// 	 * Upload file from server (Node.js)
// 	 * Requires @aws-sdk/client-s3 package
// 	 */
// 	async uploadFile(fileBuffer: Buffer, filename: string, options: UploadOptions = {}): Promise<UploadResult> {
// 		try {
// 			// Dynamic import for Node.js environment
// 			const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

// 			const key = options.key
// 				? options.key.startsWith('/')
// 					? options.key.slice(1)
// 					: options.key
// 				: this.generateKey(filename);
// 			const contentType = options.contentType || this.getContentType(filename);

// 			// Create S3 client configured for R2
// 			const s3Client = new S3Client({
// 				region: this.config.region || 'auto',
// 				endpoint: this.endpoint,
// 				credentials: {
// 					accessKeyId: this.config.accessKeyId,
// 					secretAccessKey: this.config.secretAccessKey,
// 				},
// 				forcePathStyle: true,
// 			});

// 			// Prepare upload parameters
// 			const params: any = {
// 				Bucket: this.config.bucketName,
// 				Key: key,
// 				Body: fileBuffer,
// 				ContentType: contentType,
// 				CacheControl: 'max-age=31536000',
// 				'access-control-allow-origin': '*',
// 			};

// 			if (options.cacheControl) {
// 				params.CacheControl = options.cacheControl;
// 			}

// 			if (options.metadata) {
// 				params.Metadata = options.metadata;
// 			}

// 			// Upload file
// 			const command = new PutObjectCommand(params);
// 			const response = await s3Client.send(command);

// 			return {
// 				success: true,
// 				key,
// 				url: this.getPublicUrl(key),
// 				etag: response.ETag?.replace(/"/g, ''),
// 				size: fileBuffer.length,
// 			};
// 		} catch (error) {
// 			return {
// 				success: false,
// 				key: options.key || '',
// 				url: '',
// 				size: 0,
// 				error: error instanceof Error ? error.message : 'Upload failed',
// 			};
// 		}
// 	}

// 	/**
// 	 * Upload from file path (Node.js only)
// 	 */
// 	async uploadFromPath(filePath: string, options: UploadOptions = {}): Promise<UploadResult> {
// 		try {
// 			const fs = await import('fs/promises');
// 			const path = await import('path');

// 			const fileBuffer = await fs.readFile(filePath);
// 			const filename = path.basename(filePath);

// 			return this.uploadFile(fileBuffer, filename, options);
// 		} catch (error) {
// 			return {
// 				success: false,
// 				key: options.key || '',
// 				url: '',
// 				size: 0,
// 				error: error instanceof Error ? error.message : 'Failed to read file',
// 			};
// 		}
// 	}

// 	private getPublicUrl(key: string): string {
// 		return appConfig.cloudflare.getPublicUrl(key);
// 	}

// 	private generateKey(filename: string): string {
// 		const timestamp = Date.now();
// 		const random = Math.random().toString(36).substring(2, 8);
// 		return `uploads/${timestamp}-${random}/${filename}`;
// 	}

// 	private getContentType(filename: string): string {
// 		const ext = filename.split('.').pop()?.toLowerCase();
// 		const mimeTypes: Record<string, string> = {
// 			jpg: 'image/jpeg',
// 			jpeg: 'image/jpeg',
// 			png: 'image/png',
// 			gif: 'image/gif',
// 			webp: 'image/webp',
// 			svg: 'image/svg+xml',
// 			pdf: 'application/pdf',
// 			mp4: 'video/mp4',
// 			webm: 'video/webm',
// 			mp3: 'audio/mpeg',
// 			wav: 'audio/wav',
// 			txt: 'text/plain',
// 			html: 'text/html',
// 			css: 'text/css',
// 			js: 'application/javascript',
// 			json: 'application/json',
// 		};
// 		return mimeTypes[ext || ''] || 'application/octet-stream';
// 	}
// }

// // ============================================================================
// // PRESIGNED URL GENERATOR (For secure browser uploads)
// // ============================================================================

// /**
//  * Generate presigned URLs on server for secure browser uploads
//  * This is the recommended approach for production
//  */
// export class R2PresignedUrlGenerator {
// 	private config: R2UploadConfig = appConfig.cloudflare;
// 	private endpoint: string;

// 	constructor(config?: R2UploadConfig) {
// 		if (config) this.config = config;
// 		this.endpoint = `https://${this.config.accountId}.r2.cloudflarestorage.com`;
// 	}

// 	/**
// 	 * Generate presigned upload URL
// 	 * Requires @aws-sdk/s3-request-presigner package
// 	 */
// 	async generateUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
// 		const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
// 		const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

// 		const s3Client = new S3Client({
// 			region: this.config.region || 'auto',
// 			endpoint: this.endpoint,
// 			credentials: {
// 				accessKeyId: this.config.accessKeyId,
// 				secretAccessKey: this.config.secretAccessKey,
// 			},
// 		});

// 		const command = new PutObjectCommand({
// 			Bucket: this.config.bucketName,
// 			Key: key,
// 			ContentType: contentType,
// 		});

// 		return getSignedUrl(s3Client, command, { expiresIn });
// 	}

// 	/**
// 	 * Generate presigned download URL
// 	 */
// 	async generateDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
// 		const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
// 		const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

// 		const s3Client = new S3Client({
// 			region: this.config.region || 'auto',
// 			endpoint: this.endpoint,
// 			credentials: {
// 				accessKeyId: this.config.accessKeyId,
// 				secretAccessKey: this.config.secretAccessKey,
// 			},
// 		});

// 		const command = new GetObjectCommand({
// 			Bucket: this.config.bucketName,
// 			Key: key,
// 		});

// 		return getSignedUrl(s3Client, command, { expiresIn });
// 	}
// }
