import appConfig from '@/config/appConfig';
import justFetch from '@/lib/fetch/justFetch';

interface IUploadParams {
	[key: string]: any;
	dir?: string;
	width?: number;
	fileName?: string;
}

export async function onUpload<T>(path: string, file: File, opt?: Partial<IUploadParams>) {
	//
	try {
		const formData = new FormData();
		formData.set('file', file);

		// Type-safe iteration over optional parameters
		if (opt) {
			(Object.keys(opt) as Array<keyof IUploadParams>).forEach((key) => {
				const value = opt[key];
				if (value !== undefined) {
					formData.set(String(key), String(value));
				}
			});
		}

		const data = await justFetch<T>({
			timeout: 1000 * 60 * 10,
			path: appConfig.getBaseUrl(path),
			method: 'POST',
			data: formData,
			contentType: 'multipart/form-data',
		});

		return data;
	} catch (error) {
		console.error(`onUpload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
