import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { claimRegistration, previewRegistrationClaim } from '../services/api';

const ClaimStarPage = () => {
    const { claimToken } = useParams();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [preview, setPreview] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [claiming, setClaiming] = useState(false);

    useEffect(() => {
        const loadPreview = async () => {
            try {
                const response = await previewRegistrationClaim(claimToken);
                setPreview(response);
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadPreview();
    }, [claimToken]);

    const handleClaim = async () => {
        if (!isAuthenticated) {
            navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
            return;
        }

        try {
            setClaiming(true);
            const response = await claimRegistration(claimToken);
            navigate(`/account/registrations/${response.registration_id}`);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setClaiming(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--page-background)' }}>
            <Navbar />
            <main style={{ padding: '124px 24px 80px' }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <section className="glass-card" style={{ padding: '40px 36px' }}>
                        {status === 'loading' ? (
                            <>
                                <p className="eyebrow" style={{ marginBottom: 14 }}>Claim your star</p>
                                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>Preparing this gift record</h1>
                                <p className="muted-copy">Loading the star page and claim details.</p>
                            </>
                        ) : null}

                        {status === 'error' ? (
                            <>
                                <p className="eyebrow" style={{ marginBottom: 14 }}>Claim your star</p>
                                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>This claim link isn't available</h1>
                                <p className="muted-copy" style={{ marginBottom: 20 }}>{error}</p>
                                <Link to="/search" className="secondary-button" style={{ width: 'fit-content' }}>
                                    Explore the Atlas
                                </Link>
                            </>
                        ) : null}

                        {status === 'ready' && preview ? (
                            <>
                                <p className="eyebrow" style={{ marginBottom: 14 }}>Claim your star</p>
                                <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', lineHeight: 0.95, marginBottom: 16 }}>
                                    This star was registered for you.
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 24 }}>
                                    Claim it to save the record, edit the StarWiki page later, and keep the certificate in your Aster Atlas account.
                                </p>
                                {preview.gift_message ? (
                                    <div className="glass-card" style={{ padding: '22px 22px', background: 'var(--surface-warm)', marginBottom: 20 }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Gift message</div>
                                        <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.75 }}>{preview.gift_message}</p>
                                    </div>
                                ) : null}
                                <div className="status-grid" style={{ marginBottom: 22 }}>
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Registered display name</div>
                                        <strong>{preview.registered_display_name}</strong>
                                    </div>
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Registration number</div>
                                        <strong>{preview.registration_number}</strong>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <button type="button" className="primary-button" onClick={handleClaim} disabled={claiming || !preview.can_claim}>
                                        {claiming ? 'Claiming...' : isAuthenticated ? 'Claim this star' : 'Sign in to claim'}
                                    </button>
                                    <Link to={preview.starwiki_url} className="secondary-button">
                                        Open public star page
                                    </Link>
                                </div>
                            </>
                        ) : null}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default ClaimStarPage;
