// /**
//  * Usage Examples for Cloudflare R2 Upload Helper
//  */

// import {
//   R2BrowserUploader,
//   R2ServerUploader,
//   R2PresignedUrlGenerator,
//   R2UploadConfig,
// } from './cloudflare-r2-upload';

// // ============================================================================
// // CONFIGURATION
// // ============================================================================

// const config?: R2UploadConfig = {
//   accountId: 'your-cloudflare-account-id',
//   accessKeyId: 'your-r2-access-key-id',
//   secretAccessKey: 'your-r2-secret-access-key',
//   bucketName: 'your-bucket-name',
//   region: 'auto', // Cloudflare R2 uses 'auto'
// };

// // ============================================================================
// // EXAMPLE 1: Browser Upload with Progress
// // ============================================================================

// async function browserUploadExample() {
//   const uploader = new R2BrowserUploader(config);

//   // Get file from input element
//   const fileInput = document.querySelector<HTMLInputElement>('#file-input');
//   const file = fileInput?.files?.[0];

//   if (!file) {
//     console.error('No file selected');
//     return;
//   }

//   // Upload with progress tracking
//   const result = await uploader.uploadFile(file, {
//     key: `images/${Date.now()}-${file.name}`, // Custom path
//     contentType: file.type,
//     cacheControl: 'max-age=31536000', // Cache for 1 year
//     metadata: {
//       uploadedBy: 'user-123',
//       originalName: file.name,
//     },
//     onProgress: (progress) => {
//       console.log(`Upload progress: ${progress.toFixed(2)}%`);
//       // Update progress bar UI
//       const progressBar = document.querySelector<HTMLDivElement>('#progress-bar');
//       if (progressBar) {
//         progressBar.style.width = `${progress}%`;
//       }
//     },
//   });

//   if (result.success) {
//     console.log('Upload successful!');
//     console.log('File URL:', result.url);
//     console.log('File key:', result.key);
//     console.log('ETag:', result.etag);
//   } else {
//     console.error('Upload failed:', result.error);
//   }
// }

// // ============================================================================
// // EXAMPLE 2: Server-Side Upload (Node.js)
// // ============================================================================

// async function serverUploadExample() {
//   const uploader = new R2ServerUploader(config);

//   // Upload from buffer
//   const fileBuffer = Buffer.from('Hello, R2!');
//   const result = await uploader.uploadFile(fileBuffer, 'test.txt', {
//     contentType: 'text/plain',
//     metadata: {
//       description: 'Test file',
//     },
//   });

//   if (result.success) {
//     console.log('Upload successful!');
//     console.log('File URL:', result.url);
//   } else {
//     console.error('Upload failed:', result.error);
//   }
// }

// // ============================================================================
// // EXAMPLE 3: Upload from File Path (Node.js)
// // ============================================================================

// async function uploadFromPathExample() {
//   const uploader = new R2ServerUploader(config);

//   const result = await uploader.uploadFromPath('./my-image.jpg', {
//     key: 'images/my-image.jpg',
//     contentType: 'image/jpeg',
//     cacheControl: 'public, max-age=31536000',
//   });

//   console.log(result);
// }

// // ============================================================================
// // EXAMPLE 4: Presigned URL for Secure Browser Upload
// // ============================================================================

// // SERVER-SIDE: Generate presigned URL
// async function generatePresignedUrlExample() {
//   const generator = new R2PresignedUrlGenerator(config);

//   const key = `uploads/${Date.now()}-image.jpg`;
//   const presignedUrl = await generator.generateUploadUrl(
//     key,
//     'image/jpeg',
//     3600 // Expires in 1 hour
//   );

//   // Send this URL to the client
//   return {
//     uploadUrl: presignedUrl,
//     key: key,
//   };
// }

// // CLIENT-SIDE: Upload using presigned URL
// async function uploadWithPresignedUrl(presignedUrl: string, file: File) {
//   try {
//     const response = await fetch(presignedUrl, {
//       method: 'PUT',
//       body: file,
//       headers: {
//         'Content-Type': file.type,
//       },
//     });

//     if (response.ok) {
//       console.log('Upload successful!');
//       return true;
//     } else {
//       console.error('Upload failed:', response.statusText);
//       return false;
//     }
//   } catch (error) {
//     console.error('Upload error:', error);
//     return false;
//   }
// }

// // ============================================================================
// // EXAMPLE 5: Multiple File Upload
// // ============================================================================

// async function multipleFileUploadExample(files: FileList) {
//   const uploader = new R2BrowserUploader(config);

//   const uploadPromises = Array.from(files).map((file, index) =>
//     uploader.uploadFile(file, {
//       key: `batch/${Date.now()}-${index}-${file.name}`,
//       onProgress: (progress) => {
//         console.log(`File ${index + 1}: ${progress.toFixed(2)}%`);
//       },
//     })
//   );

//   const results = await Promise.all(uploadPromises);

//   const successful = results.filter((r) => r.success);
//   const failed = results.filter((r) => !r.success);

//   console.log(`${successful.length} files uploaded successfully`);
//   console.log(`${failed.length} files failed`);

//   return results;
// }

// // ============================================================================
// // EXAMPLE 6: Upload with React Hook
// // ============================================================================

// import { useState, useCallback } from 'react';

// function useR2Upload() {
//   const [uploading, setUploading] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const [error, setError] = useState<string | null>(null);

//   const upload = useCallback(async (file: File) => {
//     const uploader = new R2BrowserUploader(config);

//     setUploading(true);
//     setProgress(0);
//     setError(null);

//     try {
//       const result = await uploader.uploadFile(file, {
//         onProgress: setProgress,
//       });

//       if (result.success) {
//         return result;
//       } else {
//         setError(result.error || 'Upload failed');
//         return null;
//       }
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Upload failed');
//       return null;
//     } finally {
//       setUploading(false);
//     }
//   }, []);

//   return { upload, uploading, progress, error };
// }

// // Usage in React component
// function UploadComponent() {
//   const { upload, uploading, progress, error } = useR2Upload();

//   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     const result = await upload(file);
//     if (result) {
//       console.log('File uploaded:', result.url);
//     }
//   };

//   return (
//     <div>
//       <input type="file" onChange={handleFileChange} disabled={uploading} />
//       {uploading && <div>Progress: {progress.toFixed(2)}%</div>}
//       {error && <div style={{ color: 'red' }}>{error}</div>}
//     </div>
//   );
// }

// // ============================================================================
// // EXAMPLE 7: Next.js API Route for Presigned URLs
// // ============================================================================

// // pages/api/upload-url.ts
// import { NextApiRequest, NextApiResponse } from 'next';
// import { R2PresignedUrlGenerator } from '../../lib/cloudflare-r2-upload';

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse
// ) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const { filename, contentType } = req.body;

//   if (!filename || !contentType) {
//     return res.status(400).json({ error: 'Missing filename or contentType' });
//   }

//   try {
//     const generator = new R2PresignedUrlGenerator(config);

//     const key = `uploads/${Date.now()}-${filename}`;
//     const uploadUrl = await generator.generateUploadUrl(key, contentType, 3600);

//     res.status(200).json({
//       uploadUrl,
//       key,
//       publicUrl: `https://storage.gotest.app/${key}`,
//     });
//   } catch (error) {
//     console.error('Error generating presigned URL:', error);
//     res.status(500).json({ error: 'Failed to generate upload URL' });
//   }
// }

// // ============================================================================
// // EXAMPLE 8: Express.js Endpoint
// // ============================================================================

// import express from 'express';
// import multer from 'multer';
// import type { error } from 'console';
// import { type } from 'os';

// const app = express();
// const upload = multer({ storage: multer.memoryStorage() });

// app.post('/upload', upload.single('file'), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded' });
//   }

//   const uploader = new R2ServerUploader(config);

//   const result = await uploader.uploadFile(
//     req.file.buffer,
//     req.file.originalname,
//     {
//       contentType: req.file.mimetype,
//     }
//   );

//   if (result.success) {
//     res.json({
//       success: true,
//       url: result.url,
//       key: result.key,
//     });
//   } else {
//     res.status(500).json({
//       success: false,
//       error: result.error,
//     });
//   }
// });

// export { app };
