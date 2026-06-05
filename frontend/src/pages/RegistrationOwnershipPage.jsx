import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchAccountRegistration, prepareRegistrationClaim } from '../services/api';
import { getPublicStarPath, getStarSlug } from '../utils/ownership';

const RegistrationOwnershipPage = () => {
    const { registrationId } = useParams();
    const [registration, setRegistration] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isPreparingClaim, setIsPreparingClaim] = useState(false);
    const absoluteClaimUrl = registration?.claim_url
        ? (registration.claim_url.startsWith('http')
            ? registration.claim_url
            : `${window.location.origin}${registration.claim_url}`)
        : null;

    useEffect(() => {
        const loadRegistration = async () => {
            try {
                const response = await fetchAccountRegistration(registrationId);
                setRegistration(response);
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadRegistration();
    }, [registrationId]);

    const handleCopyClaimLink = async () => {
        if (!registration?.claim_url) return;
        try {
            const absoluteUrl = registration.claim_url.startsWith('http')
                ? registration.claim_url
                : `${window.location.origin}${registration.claim_url}`;
            await navigator.clipboard.writeText(absoluteUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const handlePrepareClaim = async () => {
        if (!registration?.id) return;
        try {
            setError('');
            setIsPreparingClaim(true);
            const response = await prepareRegistrationClaim(registration.id);
            setRegistration(response);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsPreparingClaim(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--page-background)' }}>
            <Navbar />
            <main style={{ padding: '124px 24px 80px' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 24 }}>
                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '40px 36px' }}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>Ownership page</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>Loading your registration</h1>
                            <p className="muted-copy">Preparing the private ownership record and main star page connection.</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '40px 36px' }}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>Ownership page</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>We couldn't load that registration</h1>
                            <p className="muted-copy" style={{ marginBottom: 20 }}>{error}</p>
                            <Link to="/account" className="secondary-button" style={{ width: 'fit-content' }}>
                                Back to account
                            </Link>
                        </section>
                    ) : null}

                    {status === 'ready' && registration ? (
                        <>
                            <section className="glass-card" style={{ padding: '40px 36px' }}>
                                <p className="eyebrow" style={{ marginBottom: 14 }}>Private ownership page</p>
                                {registration.is_demo ? (
                                    <p className="eyebrow" style={{ marginBottom: 10, color: 'var(--primary-strong)' }}>Demo registration</p>
                                ) : null}
                                <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.4rem)', lineHeight: 0.95, marginBottom: 16 }}>
                                    {registration.registered_display_name}
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 760, marginBottom: 24 }}>
                                    This private ownership page shows who currently controls the registration inside Aster Atlas, how the main star page appears, and what still needs to be claimed or managed.
                                </p>
                                <div className="status-grid">
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Registration number</div>
                                        <strong>{registration.registration_number}</strong>
                                    </div>
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Ownership</div>
                                        <strong>{registration.current_holder_username || (registration.can_manage ? 'You' : 'Another authorised holder')}</strong>
                                    </div>
                                    <div className="glass-card" style={{ padding: '18px 20px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Public star page</div>
                                        <strong>{registration.public_page_visibility}</strong>
                                    </div>
                                </div>
                            </section>

                            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: 24 }}>
                                <article className="glass-card" style={{ padding: '30px 28px' }}>
                                    <p className="eyebrow" style={{ marginBottom: 14 }}>Registered star details</p>
                                    <div style={{ display: 'grid', gap: 16 }}>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Scientific name</div>
                                            <strong>{registration.star.scientific_name}</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Constellation</div>
                                            <strong>{registration.star.constellation || 'Not listed'}</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Distance from Sun</div>
                                            <strong>{registration.star.distance_ly?.toFixed?.(2) || registration.star.distance_ly} light years</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Registered to</div>
                                            <strong>{registration.registered_display_name}</strong>
                                        </div>
                                        {registration.dedication ? (
                                            <div>
                                                <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Dedication</div>
                                                <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.75 }}>{registration.dedication}</p>
                                            </div>
                                        ) : null}
                                        {registration.gift_message ? (
                                            <div>
                                                <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Gift message</div>
                                                <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.75 }}>{registration.gift_message}</p>
                                            </div>
                                        ) : null}
                                    </div>
                                </article>

                                <aside className="glass-card" style={{ padding: '30px 28px' }}>
                                    <p className="eyebrow" style={{ marginBottom: 14 }}>Manage this record</p>
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        <Link to={getPublicStarPath(registration)} className="primary-button">Open star page</Link>
                                        {registration.transaction_id ? (
                                            <Link to={`/account/orders/${registration.transaction_id}`} className="secondary-button">Open order &amp; certificate</Link>
                                        ) : null}
                                        <Link to={`/search/${getStarSlug(registration.star)}`} className="secondary-button">
                                            View in atlas
                                        </Link>
                                    </div>

                                    <div className="glass-card" style={{ padding: '18px 18px', marginTop: 18 }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Star page controls</div>
                                        <p className="muted-copy" style={{ margin: 0 }}>
                                            Full editing and visibility controls can grow here in a later phase. This foundation already separates the public-facing star page from the private ownership page.
                                        </p>
                                    </div>

                                    {registration.can_manage && registration.claim_status === 'claimable' ? (
                                        <div className="glass-card" style={{ padding: '18px 18px', marginTop: 18, background: 'var(--surface-warm)' }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>
                                                {registration.is_gift ? 'Gift status' : 'Claim link ready'}
                                            </div>
                                            <p className="muted-copy" style={{ margin: '0 0 14px 0' }}>
                                                {registration.is_gift
                                                    ? 'Waiting to be claimed. The recipient can view the gift without an account, but must claim it to edit or manage the registration.'
                                                    : 'This star can now be claimed by someone else whenever you decide to share it. Once they claim it, they become the current holder and you will lose edit access.'}
                                            </p>
                                            <div style={{ display: 'grid', gap: 12 }}>
                                                <div>
                                                    <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Registered to</div>
                                                    <strong>{registration.recipient_name || registration.registered_display_name}</strong>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Current holder</div>
                                                    <strong>You</strong>
                                                </div>
                                                {absoluteClaimUrl ? (
                                                    <div>
                                                        <div style={{ color: 'var(--text-faint)', marginBottom: 6 }}>Claim link</div>
                                                        <div className="glass-card" style={{ padding: '12px 14px', wordBreak: 'break-all' }}>
                                                            {absoluteClaimUrl}
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                    {absoluteClaimUrl ? (
                                                        <>
                                                            <button type="button" className="secondary-button" onClick={handleCopyClaimLink}>
                                                                {copied ? 'Claim link copied' : 'Copy claim link'}
                                                            </button>
                                                            <a href={absoluteClaimUrl} className="secondary-button">
                                                                Open claim page
                                                            </a>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                    {registration.can_manage && registration.can_prepare_claim && registration.claim_status !== 'claimable' ? (
                                        <div className="glass-card" style={{ padding: '18px 18px', marginTop: 18, background: 'var(--surface-warm)' }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Claim or transfer later</div>
                                            <p className="muted-copy" style={{ margin: '0 0 14px 0' }}>
                                                If you decide this star should live under someone else&apos;s account later, you can prepare a claim link here and share it when you&apos;re ready. This is available to any current holder, including someone who originally claimed the star from another person.
                                            </p>
                                            <button type="button" className="secondary-button" onClick={handlePrepareClaim} disabled={isPreparingClaim}>
                                                {isPreparingClaim ? 'Preparing claim link...' : 'Prepare claim link'}
                                            </button>
                                        </div>
                                    ) : null}
                                </aside>
                            </section>
                        </>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default RegistrationOwnershipPage;
