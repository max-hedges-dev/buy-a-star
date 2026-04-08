import { apiRequest } from './http';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function signInWithGoogleToken(idToken) {
    return apiRequest('/auth/google', {
        method: 'POST',
        credentials: 'include',
        body: {
            id_token: idToken,
        },
    });
}

export function fetchCurrentUser() {
    return apiRequest('/auth/me', {
        credentials: 'include',
    });
}

export function logoutCurrentUser() {
    return apiRequest('/auth/logout', {
        method: 'POST',
        credentials: 'include',
    });
}

export function fetchProtectedExample() {
    return apiRequest('/auth/protected', {
        credentials: 'include',
    });
}
