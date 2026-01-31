# Cloudflare R2 Upload Helper - TypeScript

A comprehensive TypeScript library for uploading files to Cloudflare R2 buckets. Supports both browser and Node.js environments.

## Features

- ✅ **Browser uploads** with progress tracking
- ✅ **Server-side uploads** (Node.js)
- ✅ **Presigned URLs** for secure browser uploads
- ✅ **TypeScript** with full type safety
- ✅ **Custom metadata** and cache control
- ✅ **Multiple file uploads**
- ✅ **React hooks** included

## Installation

### For Browser (Direct Upload)

No dependencies needed! Just copy the `R2BrowserUploader` class.

### For Node.js (Server-Side Upload)

```bash
npm install @aws-sdk/client-s3
```

### For Presigned URLs

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Setup

### 1. Get Your Cloudflare R2 Credentials

1. Go to Cloudflare Dashboard → R2
2. Create an R2 bucket (if you haven't already)
3. Go to "Manage R2 API Tokens"
4. Create a new API token with permissions for your bucket
5. Note down:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Bucket Name

### 2. Configure CORS (Important for Browser Uploads)

In your R2 bucket settings, add a CORS policy:

```json
[
	{
		"AllowedOrigins": ["*"],
		"AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
		"AllowedHeaders": ["Content-Type", "Content-Language", "Content-Encoding", "Content-Disposition", "X-Amz-Acl"],
		"ExposeHeaders": [
			"Content-Type",
			"Access-Control-Allow-Origin",
			"ETag",
			"Cache-Control",
			"Content-Disposition",
			"Content-Encoding",
			"Expires"
		],
		"MaxAgeSeconds": 3600
	}
]
```

### 3. Add Custom Domain (Recommended)

1. In R2 bucket settings → Custom Domains
2. Add your domain (e.g., `storage.gotest.app`)
3. Update DNS records as instructed
4. Update the `getPublicUrl()` method in the code to use your domain

## Quick Start

### Browser Upload

```typescript
import { R2BrowserUploader } from './cloudflare-r2-upload';

const uploader = new R2BrowserUploader({
	accountId: 'your-account-id',
	accessKeyId: 'your-access-key',
	secretAccessKey: 'your-secret-key',
	bucketName: 'your-bucket-name',
});

// Upload file with progress
const result = await uploader.uploadFile(file, {
	onProgress: (progress) => {
		console.log(`${progress}%`);
	},
});

console.log(result.url); // https://storage.gotest.app/uploads/...
```

### Server Upload (Node.js)

```typescript
import { R2ServerUploader } from './cloudflare-r2-upload';

const uploader = new R2ServerUploader({
	accountId: 'your-account-id',
	accessKeyId: 'your-access-key',
	secretAccessKey: 'your-secret-key',
	bucketName: 'your-bucket-name',
});

// Upload from buffer
const result = await uploader.uploadFile(buffer, 'filename.jpg');

// Or upload from file path
const result = await uploader.uploadFromPath('./image.jpg');
```

### Presigned URLs (Recommended for Production)

**Server-side** (Next.js API route):

```typescript
// pages/api/get-upload-url.ts
import { R2PresignedUrlGenerator } from '@/lib/cloudflare-r2-upload';

export default async function handler(req, res) {
	const generator = new R2PresignedUrlGenerator(config);

	const key = `uploads/${Date.now()}-${req.body.filename}`;
	const uploadUrl = await generator.generateUploadUrl(
		key,
		req.body.contentType,
		3600 // 1 hour expiry
	);

	res.json({ uploadUrl, key });
}
```

**Client-side**:

```typescript
// Get presigned URL from your API
const response = await fetch('/api/get-upload-url', {
	method: 'POST',
	body: JSON.stringify({
		filename: file.name,
		contentType: file.type,
	}),
});

const { uploadUrl } = await response.json();

// Upload directly to R2 using presigned URL
await fetch(uploadUrl, {
	method: 'PUT',
	body: file,
	headers: { 'Content-Type': file.type },
});
```

## Configuration Options

### Upload Options

```typescript
interface UploadOptions {
	key?: string; // Custom file path/key
	contentType?: string; // MIME type
	metadata?: Record<string, string>; // Custom metadata
	cacheControl?: string; // Cache headers
	public?: boolean; // Public access
	onProgress?: (progress: number) => void; // Progress callback
}
```

### Example with All Options

```typescript
const result = await uploader.uploadFile(file, {
	key: 'avatars/user-123.jpg',
	contentType: 'image/jpeg',
	cacheControl: 'public, max-age=31536000',
	metadata: {
		userId: '123',
		uploadedAt: new Date().toISOString(),
	},
	onProgress: (progress) => {
		updateProgressBar(progress);
	},
});
```

## Security Best Practices

### ⚠️ Never Expose Credentials in Browser Code

**❌ Don't do this:**

```typescript
// NEVER put credentials in client-side code!
const uploader = new R2BrowserUploader({
	accessKeyId: 'your-key', // ❌ Exposed in browser
	secretAccessKey: 'your-secret', // ❌ Security risk!
});
```

**✅ Do this instead:**

Use presigned URLs generated on your server:

1. **Server generates presigned URL** (credentials safe on server)
2. **Client uploads using presigned URL** (no credentials exposed)

```typescript
// Server-side
const uploadUrl = await generator.generateUploadUrl(key, contentType);

// Client-side
await fetch(uploadUrl, {
	method: 'PUT',
	body: file,
});
```

## React Integration

### Custom Hook

```typescript
import { useState } from 'react';
import { R2BrowserUploader } from './cloudflare-r2-upload';

function useR2Upload() {
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);

	const upload = async (file: File) => {
		setUploading(true);
		const uploader = new R2BrowserUploader(config);

		const result = await uploader.uploadFile(file, {
			onProgress: setProgress,
		});

		setUploading(false);
		return result;
	};

	return { upload, uploading, progress };
}
```

### Component Example

```typescript
function ImageUploader() {
  const { upload, uploading, progress } = useR2Upload();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await upload(file);
    if (result.success) {
      console.log('Uploaded:', result.url);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <progress value={progress} max={100} />}
    </div>
  );
}
```

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Verify CORS policy is configured in R2 bucket settings
2. Ensure your domain is in `AllowedOrigins`
3. Check that all required headers are in `AllowedHeaders`

### 403 Forbidden

- Check your Access Key ID and Secret Access Key
- Verify bucket name is correct
- Ensure API token has proper permissions

### Upload Fails Silently

- Check browser console for errors
- Verify file size doesn't exceed limits
- Check network tab in DevTools

### Custom Domain Not Working

- Verify DNS records are properly configured
- Wait for DNS propagation (can take up to 24 hours)
- Update `getPublicUrl()` method with your domain

## Environment Variables

For production, use environment variables:

```bash
# .env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
```

```typescript
const config = {
	accountId: process.env.R2_ACCOUNT_ID!,
	accessKeyId: process.env.R2_ACCESS_KEY_ID!,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	bucketName: process.env.R2_BUCKET_NAME!,
};
```

## API Reference

### R2BrowserUploader

- `uploadFile(file: File, options?: UploadOptions): Promise<UploadResult>`

### R2ServerUploader

- `uploadFile(buffer: Buffer, filename: string, options?: UploadOptions): Promise<UploadResult>`
- `uploadFromPath(path: string, options?: UploadOptions): Promise<UploadResult>`

### R2PresignedUrlGenerator

- `generateUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>`
- `generateDownloadUrl(key: string, expiresIn?: number): Promise<string>`

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
