import { apiRequest } from './http';
import { DEMO_MODE } from '../config/appEnv';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const DEMO_AUTH_ENABLED = DEMO_MODE;

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

export function updateCurrentUserProfile({ username }) {
    return apiRequest('/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        body: { username },
    });
}

export function signInAsDemoRole(role) {
    return apiRequest('/auth/demo-login', {
        method: 'POST',
        credentials: 'include',
        body: { role },
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
