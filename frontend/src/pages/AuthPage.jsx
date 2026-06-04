import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Navbar from '../components/Navbar';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { DEMO_MODE, APP_ENV } from '../config/appEnv';
import { useAuth } from '../hooks/useAuth';

const pageStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top, rgba(216,168,95,0.16), transparent 32%), radial-gradient(circle at 20% 20%, rgba(93,130,184,0.14), transparent 28%), linear-gradient(180deg, #070a11 0%, #020305 100%)',
};

const AuthPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { authError, clearAuthError, isAuthenticated, isLoadingUser, isSigningIn, signInAsDemo, signInWithGoogle } = useAuth();

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

    const handleDemoSignIn = async (role) => {
        await signInAsDemo(role);
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
                    <p className="eyebrow" style={{ marginBottom: 14 }}>Account Access</p>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', fontWeight: 600, lineHeight: 0.98, marginBottom: 14 }}>
                        Enter your Aster Atlas account.
                    </h1>
                    <p className="muted-copy" style={{ marginBottom: 28 }}>
                        Save your registered stars, certificates, and ownership pages in one place.
                    </p>

                    <div style={{ display: 'grid', gap: 18 }}>
                        {DEMO_MODE ? (
                            <div className="glass-card" style={{ padding: '20px 20px', background: 'rgba(216,168,95,0.08)', border: '1px solid rgba(216,168,95,0.18)' }}>
                                <div className="eyebrow" style={{ marginBottom: 12 }}>Internal demo access</div>
                                <p className="muted-copy" style={{ marginBottom: 16 }}>
                                    Demo mode is enabled for this {APP_ENV} environment. Use a seeded demo identity to test the full account-based journey without Google OAuth.
                                </p>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    {[
                                        {
                                            role: 'user1',
                                            label: 'Continue as demo user 1',
                                            body: 'Use this to test signing in, registering stars, managing ownership pages, and claiming or sharing stars later.',
                                        },
                                        {
                                            role: 'user2',
                                            label: 'Continue as demo user 2',
                                            body: 'Use this to test the same ownership, claim, and sharing powers from a second account.',
                                        },
                                    ].map((option) => (
                                        <div key={option.role} className="glass-card" style={{ padding: '14px 14px', background: 'rgba(245,239,226,0.03)' }}>
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() => handleDemoSignIn(option.role)}
                                                disabled={isLoadingUser || isSigningIn}
                                                style={{ width: '100%', marginBottom: 8 }}
                                            >
                                                {option.label}
                                            </button>
                                            <p className="muted-copy" style={{ margin: 0, fontSize: '0.9rem' }}>{option.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 10, fontSize: '0.92rem' }}>Continue with Google</div>
                            <GoogleSignInButton disabled={isLoadingUser || isSigningIn} onCredential={handleGoogleCredential} />
                        </div>

                        {isLoadingUser ? (
                            <div className="status-banner">Checking whether you already have an active session...</div>
                        ) : null}

                        {isSigningIn ? (
                            <div className="status-banner">Finishing sign-in and preparing your Aster Atlas session...</div>
                        ) : null}

                        {authError ? (
                            <div className="status-banner status-banner-error">{authError}</div>
                        ) : null}
                    </div>

                    <div
                        style={{
                            marginTop: 28,
                            paddingTop: 22,
                            borderTop: '1px solid rgba(245,239,226,0.1)',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.7,
                        }}
                    >
                        <p>
                            Just looking around? <Link to="/search" style={{ color: 'var(--primary-strong)' }}>Explore the Atlas</Link>.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default AuthPage;
