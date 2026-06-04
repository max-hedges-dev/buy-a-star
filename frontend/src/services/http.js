import { API_BASE_ENV } from '../config/appEnv';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

function resolveApiBaseUrl() {
    const configuredBaseUrl = API_BASE_ENV;

    try {
        const currentHost = window.location.hostname;
        const parsedUrl = new URL(configuredBaseUrl);
        if (LOOPBACK_HOSTS.has(currentHost) && LOOPBACK_HOSTS.has(parsedUrl.hostname) && currentHost !== parsedUrl.hostname) {
            parsedUrl.hostname = currentHost;
        }
        return parsedUrl.toString().replace(/\/$/, '');
    } catch {
        return configuredBaseUrl.replace(/\/$/, '');
    }
}

const API_BASE_URL = resolveApiBaseUrl();

export async function apiRequest(path, options = {}) {
    const { body, headers, credentials = 'include', ...rest } = options;
    const isJsonBody = body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string';

    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials,
        headers: {
            ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        ...(body !== undefined ? { body: isJsonBody ? JSON.stringify(body) : body } : {}),
        ...rest,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = payload?.detail || payload?.message || 'Request failed.';
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

export { API_BASE_URL };
