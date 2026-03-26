import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Navbar from '../components/Navbar';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/useAuth';

const pageStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top, rgba(255,77,0,0.22), transparent 32%), radial-gradient(circle at 20% 20%, rgba(0,188,212,0.14), transparent 28%), linear-gradient(180deg, #050505 0%, #020202 100%)',
};

const AuthPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { authError, clearAuthError, isAuthenticated, isLoadingUser, isSigningIn, signInWithGoogle } = useAuth();

    const params = new URLSearchParams(location.search);
    const nextPath = params.get('next') || '/account';

    useEffect(() => {
        clearAuthError();
    }, [clearAuthError]);

    useEffect(() => {
        if (!isLoadingUser && isAuthenticated) {
            navigate(nextPath, { replace: true });
        }
    }, [isAuthenticated, isLoadingUser, navigate, nextPath]);

    const handleGoogleCredential = async (credential) => {
        await signInWithGoogle(credential);
        navigate(nextPath, { replace: true });
    };

    return (
        <div style={pageStyle}>
            <Navbar />
            <main
                style={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    padding: '120px 24px 48px',
                }}
            >
                <section className="glass-card" style={{ maxWidth: 540, width: '100%', padding: '42px 40px' }}>
                    <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', marginBottom: 14 }}>
                        Create Your Account
                    </h1>
                    <p className="muted-copy" style={{ marginBottom: 28 }}>
                        Sign up to access your account.
                    </p>

                    <div style={{ display: 'grid', gap: 18 }}>
                        <GoogleSignInButton disabled={isLoadingUser || isSigningIn} onCredential={handleGoogleCredential} />

                        {isLoadingUser ? (
                            <div className="status-banner">Checking whether you already have an active session...</div>
                        ) : null}

                        {isSigningIn ? (
                            <div className="status-banner">Finishing sign-in and creating your Aster Atlas session...</div>
                        ) : null}

                        {authError ? (
                            <div className="status-banner status-banner-error">{authError}</div>
                        ) : null}
                    </div>

                    <div
                        style={{
                            marginTop: 28,
                            paddingTop: 22,
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.7)',
                            lineHeight: 1.7,
                        }}
                    >
                        <p>
                            Just looking to search the stars?  <Link to="/search" style={{ color: 'var(--primary)' }}> Explore the galaxy</Link>.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default AuthPage;
