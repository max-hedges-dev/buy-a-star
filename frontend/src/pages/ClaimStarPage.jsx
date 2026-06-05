import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { claimRegistration, previewRegistrationClaim } from '../services/api';
import { formatClaimStatus, getStarSlug } from '../utils/ownership';

const ClaimStarPage = () => {
    const { claimToken } = useParams();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [preview, setPreview] = useState(null);
    const [claimedResult, setClaimedResult] = useState(null);
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
            setError('');
            setClaiming(true);
            const response = await claimRegistration(claimToken);
            setClaimedResult(response);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setClaiming(false);
        }
    };

    const ownershipPath = claimedResult
        ? `/account/registrations/${claimedResult.registration_id}`
        : preview
            ? `/account/registrations/${preview.registration_id}`
            : '/account';
    const certificatePath = claimedResult?.transaction_id
        ? `/account/orders/${claimedResult.transaction_id}`
        : ownershipPath;

    if (status === 'ready' && preview && !claimedResult) {
        return <Navigate to={`/search/${getStarSlug(preview.star)}?claim=${encodeURIComponent(claimToken)}`} replace />;
    }

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

                        {status === 'ready' && claimedResult ? (
                            <>
                                <p className="eyebrow" style={{ marginBottom: 14 }}>Claim complete</p>
                                <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', lineHeight: 0.95, marginBottom: 16 }}>
                                    This star is now saved to your Aster Atlas account.
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 24 }}>
                                    The registration is now attached to your account as the current holder. You can open the ownership page, revisit the main star page, or return later for the certificate.
                                </p>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <Link to={ownershipPath} className="primary-button">
                                        Open ownership page
                                    </Link>
                                    <Link to={claimedResult.starwiki_url} className="secondary-button">
                                        Open star page
                                    </Link>
                                    <Link to={certificatePath} className="secondary-button">
                                        Download certificate
                                    </Link>
                                </div>
                            </>
                        ) : null}

                        {status === 'ready' && preview && !claimedResult ? (
                            <>
                                <p className="eyebrow" style={{ marginBottom: 14 }}>Claim your star</p>
                                {preview.is_demo ? (
                                    <p className="eyebrow" style={{ marginBottom: 10, color: 'var(--primary-strong)' }}>Demo gift</p>
                                ) : null}
                                <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', lineHeight: 0.95, marginBottom: 16 }}>
                                    {preview.recipient_name ? 'This star was registered for you.' : 'This star has been shared with you.'}
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 24 }}>
                                    Claim it to save the record, manage the star from your account later, and keep the certificate in your Aster Atlas account.
                                </p>
                                <div className="status-grid" style={{ marginBottom: 22 }}>
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Claim status</div>
                                        <strong>{preview.claim_status === 'claimable' ? 'Unclaimed' : preview.claim_status}</strong>
                                    </div>
                                    {preview.purchaser_name ? (
                                        <div className="glass-card" style={{ padding: '18px 20px' }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Registered by</div>
                                            <strong>{preview.purchaser_name}</strong>
                                        </div>
                                    ) : null}
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Star</div>
                                        <strong>{preview.star.display_name || preview.star.scientific_name}</strong>
                                    </div>
                                </div>
                                {preview.gift_message ? (
                                    <div className="glass-card" style={{ padding: '22px 22px', background: 'var(--surface-warm)', marginBottom: 20 }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Gift message</div>
                                        <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.75 }}>{preview.gift_message}</p>
                                    </div>
                                ) : null}
                                {preview.dedication ? (
                                    <div className="glass-card" style={{ padding: '22px 22px', marginBottom: 20 }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Dedication</div>
                                        <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.75 }}>{preview.dedication}</p>
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
                                {preview.can_claim ? (
                                    <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
                                        <button type="button" className="primary-button" onClick={handleClaim} disabled={claiming}>
                                            {claiming ? 'Claiming...' : isAuthenticated ? 'Claim this star' : 'Sign in to claim'}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="status-banner" style={{ marginBottom: 20 }}>
                                            This claim link has already been used. Claim status: {formatClaimStatus(preview.claim_status)}.
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            <Link to={preview.starwiki_url} className="primary-button">
                                                Open star page
                                            </Link>
                                            <Link to="/auth" className="secondary-button">
                                                Enter your account
                                            </Link>
                                        </div>
                                    </>
                                )}
                                {error ? (
                                    <p style={{ marginTop: 16, color: 'var(--status-danger)' }}>{error}</p>
                                ) : null}
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
