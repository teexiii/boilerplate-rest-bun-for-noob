import type { RawAxiosRequestHeaders } from 'axios';

export interface FetchResponse<T> {
	code: number | unknown;
	status: number;
	data: T;
	error?: boolean;
	message?: string;
	query?: any;
}

export interface IFetch {
	path: string;
	data?: any;
	headers?: RawAxiosRequestHeaders;
	method?: string;
	contentType?: 'multipart/form-data' | 'application/json' | 'application/x-www-form-urlencoded';
}
