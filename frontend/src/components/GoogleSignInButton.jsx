import React, { useEffect, useEffectEvent, useRef, useState } from 'react';

import { GOOGLE_CLIENT_ID } from '../services/auth';
import { DEMO_MODE } from '../config/appEnv';

const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let googleIdentityScriptPromise;

function loadGoogleIdentityScript() {
    if (window.google?.accounts?.id) {
        return Promise.resolve(window.google);
    }

    if (!googleIdentityScriptPromise) {
        googleIdentityScriptPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(window.google), { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(window.google);
            script.onerror = () => reject(new Error('Unable to load Google Identity Services.'));
            document.head.appendChild(script);
        });
    }

    return googleIdentityScriptPromise;
}

const GoogleSignInButton = ({ disabled = false, onCredential }) => {
    const buttonRef = useRef(null);
    const [runtimeErrorMessage, setRuntimeErrorMessage] = useState('');
    const isConfigured = Boolean(GOOGLE_CLIENT_ID);
    const configurationErrorMessage = isConfigured
        ? ''
        : DEMO_MODE
            ? ''
            : 'Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env, then restart the frontend server.';

    const handleCredential = useEffectEvent(async (response) => {
        if (!response?.credential) {
            setRuntimeErrorMessage('Google sign-in completed without a usable credential.');
            return;
        }

        setRuntimeErrorMessage('');
        await onCredential(response.credential);
    });

    useEffect(() => {
        let isActive = true;
        const buttonElement = buttonRef.current;

        if (!isConfigured || !buttonElement) {
            return undefined;
        }

        loadGoogleIdentityScript()
            .then(() => {
                if (!isActive || !window.google?.accounts?.id) {
                    return;
                }

                buttonElement.innerHTML = '';
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: (response) => {
                        void handleCredential(response);
                    },
                    auto_select: false,
                    cancel_on_tap_outside: true,
                    context: 'signin',
                });
                window.google.accounts.id.renderButton(buttonElement, {
                    theme: 'filled_black',
                    size: 'large',
                    shape: 'pill',
                    text: 'continue_with',
                    width: 320,
                    logo_alignment: 'left',
                });
            })
            .catch(() => {
                if (isActive) {
                    setRuntimeErrorMessage('Google sign-in could not be loaded right now.');
                }
            });

        return () => {
            isActive = false;
            buttonElement.innerHTML = '';
        };
    }, [isConfigured]);

    const errorMessage = runtimeErrorMessage || configurationErrorMessage;

    return (
        <>
            {isConfigured ? (
                <div
                    ref={buttonRef}
                    style={{
                        opacity: disabled ? 0.6 : 1,
                        pointerEvents: disabled ? 'none' : 'auto',
                    }}
                />
            ) : (
                <button
                    type="button"
                    disabled
                    style={{
                        width: '100%',
                        maxWidth: 320,
                        height: 44,
                        borderRadius: 999,
                        border: '1px solid rgba(245,239,226,0.12)',
                        background: 'rgba(245,239,226,0.06)',
                        color: 'rgba(245,239,226,0.72)',
                        fontSize: '0.98rem',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                    }}
                >
                    Continue with Google
                </button>
            )}
            {errorMessage ? (
                <p style={{ color: '#ff8e73', fontSize: '0.95rem', lineHeight: 1.5 }}>{errorMessage}</p>
            ) : null}
        </>
    );
};

export default GoogleSignInButton;
