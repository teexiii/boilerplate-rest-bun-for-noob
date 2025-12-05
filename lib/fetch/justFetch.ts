import type { AxiosRequestConfig, AxiosResponse, RawAxiosRequestHeaders } from 'axios';
import axios from 'axios';
import { toFormData, toQueryString } from '@/lib/fetch/helper';
import type { IFetch, FetchResponse } from '@/lib/fetch/type';

const getStatus = (data: any) => {
	if (!data) return 0;

	return data.code == 200 || data.status === 'success' || data.status == true || data?.success || data.msg == 'success'
		? 1
		: 0;
};

export default async function justFetch<T>({
	path,
	data,
	headers,
	method = 'GET',
	contentType = 'application/json',
	...rest
}: IFetch & Partial<AxiosRequestConfig>): Promise<FetchResponse<T>> {
	const config: AxiosRequestConfig = {
		...rest,
		url: path,
		method,
		headers: {
			'Content-Type': contentType,
			...headers,
		},
		maxBodyLength: Infinity,
		maxContentLength: Infinity,
	};

	try {
		switch (contentType) {
			case 'application/json':
				{
					config.data = data;
				}
				break;
			case 'application/x-www-form-urlencoded':
				{
					const form = toFormData(data);
					config.data = toQueryString(form);
				}
				break;
			case 'multipart/form-data':
				{
					delete config.headers?.['Content-Type'];
					config.data = data;
				}
				break;
			default:
				break;
		}

		switch (method) {
			case 'GET':
			case 'get':
				{
					delete config.headers?.['Content-Type'];
				}
				break;

			default:
				break;
		}

		if (!config.data) {
			delete config.headers?.['Content-Type'];
			delete config.data;
		}

		const result: AxiosResponse = await axios(config);
		const response: FetchResponse<T> = {
			data: result?.data?.metadata,
			...result?.data,
			status: getStatus(result?.data),
			code: result.status,
		};

		response.data = response.data || (true as T);

		delete (response as any).metadata;

		return response;
	} catch (e) {
		console.log(JSON.stringify(config, null, 2));
		console.log('RESPONSE_DATA :>> ', (e as any)?.response?.data);

		// If we have a response from the server
		if ((e as any)?.response) {
			try {
				const responseData = (e as any)?.response.data;

				const obj = {
					data: responseData.metadata,
					...(typeof responseData == 'string' ? { message: responseData } : { ...responseData }),
					code: (e as any)?.response.status,
					status: getStatus(responseData),
				};

				return obj;
			} catch (error) {
				throw new Error(`${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// No response from server - network/connection error
		let errorMessage = 'Network error occurred';
		if (axios.isAxiosError(e)) {
			if (e.code === 'ECONNREFUSED') {
				errorMessage = `Cannot connect to server.`;
			} else if (e.code === 'ERR_NETWORK') {
				errorMessage = `Network error.`;
			} else if (e.message) {
				errorMessage = e.message;
			}
		} else if (e instanceof Error) {
			errorMessage = e.message;
		}

		console.error('Fetch error:', errorMessage);

		return fetchFail<T>({
			code: 500,
			message: errorMessage,
			query: data,
		});
	}
}

export function fetchFail<T>({ code = 500, message = 'Vui lòng thử lại sau', query = {} }) {
	return {
		data: undefined as T,
		code,
		status: 0,
		error: true,
		message,
		query,
	};
}

export function fetchSuccess<T>(data: T) {
	return { code: 200, status: 1, data, message: 'Success' };
}
