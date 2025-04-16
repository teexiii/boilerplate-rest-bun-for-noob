const headers = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
	'Content-Type': 'application/json',
};

const DEFAULT_ERROR = 'Website đang bảo trì';

export const getFailedResponse = (message: string = DEFAULT_ERROR) => {
	return JSON.stringify({ status: false, message });
};

export const getSuccessResponse = (data?: ISuccess) => {
	return JSON.stringify({ ...data, status: true });
};

interface ISuccess {
	data?: unknown;
	message?: string;
}

export const success = (data?: ISuccess, header?: any) => {
	return new Response(getSuccessResponse(data), {
		status: 200,
		headers: {
			...headers,
			header,
		},
	});
};

export const responseRedirect = (location = '/') => {
	return new Response(null, {
		status: 302,
		headers: {
			...headers,
			Location: location,
		},
	});
};

export const fail404 = (message = 'Not Found') => {
	return fail(message, 404);
	// return responseRedirect("/404");
};

export const fail = (message: string, status: number) => {
	return new Response(getFailedResponse(message), {
		status,
		headers,
	});
};

export const fail400 = (message = DEFAULT_ERROR) => {
	return fail(message, 400);
};

export const fail401 = (message = 'Unauthorized') => {
	return fail(message, 401);
};

export const fail403 = (message = 'Access denied') => {
	return fail(message, 403);
};

export const fail500 = (message = 'Website đang bảo trì') => {
	return fail(message, 500);
};
