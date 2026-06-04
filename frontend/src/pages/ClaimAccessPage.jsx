import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { DEMO_MODE } from '../config/appEnv';
import { useAuth } from '../hooks/useAuth';

const extractClaimToken = (value) => {
    const raw = (value || '').trim();
    if (!raw) return null;

    try {
        const parsedUrl = new URL(raw);
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        const claimIndex = segments.indexOf('claim');
        if (claimIndex >= 0 && segments[claimIndex + 1]) {
            return segments[claimIndex + 1];
        }
    } catch {
        // Not a full URL, continue with plain token parsing.
    }

    return /^\d+-[a-f0-9]+$/i.test(raw) ? raw : null;
};

const ClaimAccessPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingUser, isSigningIn, signInAsDemo } = useAuth();
    const [claimInput, setClaimInput] = useState('');
    const [error, setError] = useState('');

    const parsedToken = useMemo(() => extractClaimToken(claimInput), [claimInput]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!parsedToken) {
            setError('Paste a full claim link or claim code to continue.');
            return;
        }
        setError('');
        navigate(`/claim/${parsedToken}`);
    };

    const handleDemoRecipient = async () => {
        await signInAsDemo('user2');
        navigate('/claim', { replace: true });
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--page-background)' }}>
            <Navbar />
            <main style={{ padding: '124px 24px 80px' }}>
                <div style={{ maxWidth: 880, margin: '0 auto' }}>
                    <section className="glass-card" style={{ padding: '40px 36px' }}>
                        <p className="eyebrow" style={{ marginBottom: 14 }}>Claim a star</p>
                        <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.4rem)', lineHeight: 0.95, marginBottom: 16 }}>
                            {isAuthenticated ? 'Claim a shared star into your account.' : 'Sign in or create an account to claim a shared star.'}
                        </h1>
                        <p className="muted-copy" style={{ maxWidth: 760, marginBottom: 28 }}>
                            {isAuthenticated
                                ? 'Paste the claim link or claim code you were given. Once claimed, the registration moves under your Aster Atlas account and you become the current holder.'
                                : 'A claim link lets a recipient save a shared star to their Aster Atlas account, open the ownership page, and manage any editable parts of the record later.'}
                        </p>

                        {!isAuthenticated && !isLoadingUser ? (
                            <>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                                    <Link to="/auth?next=%2Fclaim" className="primary-button">
                                        Sign in to claim
                                    </Link>
                                    <Link to="/auth?next=%2Fclaim" className="secondary-button">
                                        Create account to claim
                                    </Link>
                                    {DEMO_MODE ? (
                                        <button type="button" className="secondary-button" onClick={handleDemoRecipient} disabled={isSigningIn}>
                                            {isSigningIn ? 'Preparing demo user 2...' : 'Continue as demo user 2'}
                                        </button>
                                    ) : null}
                                </div>
                                <div className="status-banner">
                                    Once you are signed in, this page becomes your claim portal where you can paste a link or code and complete the transfer.
                                </div>
                            </>
                        ) : null}

                        {isAuthenticated ? (
                            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
                                <label style={{ display: 'grid', gap: 10 }}>
                                    <span className="eyebrow" style={{ marginBottom: 0 }}>Claim link or code</span>
                                    <input
                                        type="text"
                                        value={claimInput}
                                        onChange={(event) => {
                                            setClaimInput(event.target.value);
                                            if (error) setError('');
                                        }}
                                        placeholder="Paste the full claim link or the claim code"
                                        style={{
                                            width: '100%',
                                            padding: '16px 18px',
                                            borderRadius: 18,
                                            border: '1px solid rgba(245,239,226,0.12)',
                                            background: 'rgba(245,239,226,0.04)',
                                            color: 'var(--text-primary)',
                                            fontSize: '1rem',
                                        }}
                                    />
                                </label>
                                {error ? (
                                    <div className="status-banner status-banner-error">{error}</div>
                                ) : null}
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <button type="submit" className="primary-button" disabled={!parsedToken}>
                                        Continue to claim details
                                    </button>
                                    <Link to="/search" className="secondary-button">
                                        Find a Star
                                    </Link>
                                </div>
                            </form>
                        ) : null}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default ClaimAccessPage;
