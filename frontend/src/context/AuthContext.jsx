import { useCallback, useEffect, useState } from 'react';

import { AuthContext } from './auth-context';
import {
    fetchCurrentUser,
    logoutCurrentUser,
    signInAsDemoRole,
    signInWithGoogleToken,
    updateCurrentUserProfile,
} from '../services/auth';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [authError, setAuthError] = useState('');

    const clearAuthError = useCallback(() => {
        setAuthError('');
    }, []);

    const refreshSession = useCallback(async () => {
        setIsLoadingUser(true);

        try {
            const response = await fetchCurrentUser();
            setUser(response.user);
            clearAuthError();
        } catch (error) {
            setUser(null);
            if (error.status !== 401) {
                setAuthError(error.message);
            }
        } finally {
            setIsLoadingUser(false);
        }
    }, [clearAuthError]);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    const signInWithGoogle = useCallback(async (idToken) => {
        setIsSigningIn(true);
        clearAuthError();

        try {
            const response = await signInWithGoogleToken(idToken);
            setUser(response.user);
            return response.user;
        } catch (error) {
            setAuthError(error.message);
            throw error;
        } finally {
            setIsSigningIn(false);
        }
    }, [clearAuthError]);

    const signInAsDemo = useCallback(async (role) => {
        setIsSigningIn(true);
        clearAuthError();

        try {
            const response = await signInAsDemoRole(role);
            setUser(response.user);
            return response.user;
        } catch (error) {
            setAuthError(error.message);
            throw error;
        } finally {
            setIsSigningIn(false);
        }
    }, [clearAuthError]);

    const logout = useCallback(async () => {
        try {
            await logoutCurrentUser();
        } finally {
            window.google?.accounts?.id?.disableAutoSelect?.();
            setUser(null);
            clearAuthError();
        }
    }, [clearAuthError]);

    const updateProfile = useCallback(async (payload) => {
        clearAuthError();
        try {
            const response = await updateCurrentUserProfile(payload);
            setUser(response.user);
            return response.user;
        } catch (error) {
            setAuthError(error.message);
            throw error;
        }
    }, [clearAuthError]);

    const value = {
        authError,
        clearAuthError,
        isAuthenticated: Boolean(user),
        isLoadingUser,
        isSigningIn,
        logout,
        refreshSession,
        signInAsDemo,
        signInWithGoogle,
        updateProfile,
        user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
