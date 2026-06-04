import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import CertificatePreview from '../components/CertificatePreview';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOrder, fetchCheckoutSessionStatus } from '../services/api';
import {
    formatDate,
    formatClaimStatus,
    getDeliveryLabel,
    getOrderPath,
    getOwnedStarPath,
    getPublicStarPath,
} from '../utils/ownership';

const pageStyle = {
    padding: 'calc(var(--nav-height) + 48px) 24px 110px',
    minHeight: '100vh',
    background: `
        radial-gradient(circle at top center, rgba(255,101,24,0.18), transparent 26%),
        radial-gradient(circle at 20% 18%, rgba(255,255,255,0.06), transparent 22%),
        linear-gradient(180deg, #040404 0%, #090909 100%)
    `,
};

const primaryButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '15px 20px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #ff5b16 0%, #ff8b2d 100%)',
    color: 'white',
    fontWeight: 700,
    letterSpacing: '0.04em',
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 18px 40px rgba(255,91,22,0.22)',
};

const tileStyle = {
    padding: '18px 20px',
    borderRadius: 22,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const CheckoutCompletePage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState('loading');
    const [checkoutData, setCheckoutData] = useState(null);
    const [order, setOrder] = useState(null);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [copied, setCopied] = useState(false);
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 960 });
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const heroPadding = `${px(42)}px ${px(40)}px`;
    const cardPadding = `${px(28)}px ${px(30)}px`;
    const actionStyle = {
        width: isNarrow ? '100%' : 'fit-content',
        minWidth: isNarrow ? 0 : 220,
    };

    useEffect(() => {
        const loadStatus = async () => {
            if (!sessionId) {
                setStatus('error');
                setError('Missing Stripe checkout session.');
                return;
            }

            try {
                const response = await fetchCheckoutSessionStatus(sessionId);
                setCheckoutData(response);
                setStatus(response.fulfilled ? 'success' : 'pending');

                if (response.fulfilled && response.transaction_id) {
                    try {
                        const orderResponse = await fetchAccountOrder(response.transaction_id);
                        setOrder(orderResponse);
                    } catch (orderError) {
                        setWarning('Your star was registered, but we could not load the ownership details automatically. You can open them from your account.');
                    }
                }
            } catch (requestError) {
                setStatus('error');
                setError(requestError.message);
            }
        };

        loadStatus();
    }, [sessionId]);

    const ownedStarPath = useMemo(() => (
        checkoutData?.registration_id
            ? getOwnedStarPath({ registration_id: checkoutData.registration_id })
            : checkoutData?.transaction_id && order
                ? getOwnedStarPath(order)
                : null
    ), [checkoutData, order]);

    const handleCopyClaimLink = async () => {
        if (!checkoutData?.claim_url) return;
        try {
            const absoluteUrl = checkoutData.claim_url.startsWith('http')
                ? checkoutData.claim_url
                : `${window.location.origin}${checkoutData.claim_url}`;
            await navigator.clipboard.writeText(absoluteUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const absoluteClaimUrl = checkoutData?.claim_url
        ? (checkoutData.claim_url.startsWith('http')
            ? checkoutData.claim_url
            : `${window.location.origin}${checkoutData.claim_url}`)
        : null;

    return (
        <>
            <Navbar />
            <section style={{ ...pageStyle, padding: `calc(var(--nav-height) + ${px(48)}px) ${pagePaddingX}px ${px(110)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: heroPadding, textAlign: 'center' }}>
                            <div style={{ width: '72px', height: '1px', margin: '0 auto 28px', background: 'rgba(255,255,255,0.78)' }} />
                            <div className="eyebrow" style={{ marginBottom: 18 }}>Registration Confirmation</div>
                            <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', marginBottom: 16 }}>
                                Finalising your registry record
                            </h1>
                            <p className="muted-copy" style={{ maxWidth: 680, margin: '0 auto' }}>
                                We&apos;re confirming your payment with Stripe and issuing the registry record now.
                            </p>
                        </section>
                    ) : null}

                    {status === 'success' && checkoutData ? (
                        <>
                            <section className="glass-card" style={{ padding: heroPadding }}>
                                <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.25fr 0.95fr', gap: px(28), alignItems: 'start' }}>
                                    <div>
                                        <div className="eyebrow" style={{ marginBottom: 18 }}>Registration Confirmed</div>
                                        {checkoutData.is_demo ? (
                                            <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--primary-strong)' }}>Demo registration</div>
                                        ) : null}
                                        <h1 style={{ fontSize: 'clamp(2.6rem, 5.4vw, 4.8rem)', lineHeight: 0.94, marginBottom: 16 }}>
                                            {checkoutData.recipient_name || checkoutData.owner_name}&rsquo;s star has been registered.
                                        </h1>
                                        <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 28 }}>
                                            Your registration is complete, the private registry record has been issued, and your certificate access is ready. This star now appears in your Aster Atlas account with its public StarWiki page and private ownership page.
                                        </p>
                                        {warning ? (
                                            <div className="status-banner" style={{ marginBottom: 20 }}>{warning}</div>
                                        ) : null}
                                        {absoluteClaimUrl ? (
                                            <div className="glass-card" style={{ padding: '18px 18px', marginBottom: 22, background: 'var(--surface-warm)' }}>
                                                <div className="eyebrow" style={{ marginBottom: 8 }}>Claim link</div>
                                                <div style={{ wordBreak: 'break-all', color: 'var(--text-primary)', marginBottom: 12 }}>
                                                    {absoluteClaimUrl}
                                                </div>
                                                <p className="muted-copy" style={{ margin: 0 }}>
                                                    Share this link with the recipient whenever you are ready. They can view the gift first, then claim it into their own Aster Atlas account.
                                                </p>
                                            </div>
                                        ) : null}

                                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
                                            {ownedStarPath ? (
                                                <Link to={ownedStarPath} style={primaryButtonStyle}>
                                                    Open ownership page
                                                </Link>
                                            ) : null}
                                            {checkoutData.transaction_id ? (
                                                <Link to={getOrderPath(checkoutData.transaction_id)} className="secondary-button" style={actionStyle}>
                                                    Open certificate
                                                </Link>
                                            ) : null}
                                            <Link to={checkoutData.public_page_slug ? `/starwiki/${checkoutData.public_page_slug}` : (order ? getPublicStarPath(order.star) : '/search')} className="secondary-button" style={actionStyle}>
                                                Open StarWiki page
                                            </Link>
                                        </div>

                                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                            <Link to="/account?section=overview" className="secondary-button" style={actionStyle}>
                                                Enter account
                                            </Link>
                                            {absoluteClaimUrl ? (
                                                <>
                                                    <button type="button" onClick={handleCopyClaimLink} className="secondary-button" style={actionStyle}>
                                                        {copied ? 'Claim link copied' : 'Copy claim link'}
                                                    </button>
                                                    <a href={absoluteClaimUrl} className="secondary-button" style={actionStyle}>
                                                        Open recipient claim page
                                                    </a>
                                                </>
                                            ) : null}
                                            {checkoutData.transaction_id ? (
                                                <Link to={getOrderPath(checkoutData.transaction_id)} className="secondary-button" style={actionStyle}>
                                                    View Receipt
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>

                                    <aside style={{ display: 'grid', gap: 16 }}>
                                        <div style={tileStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>Registration Number</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{checkoutData.registration_number || 'Pending'}</div>
                                        </div>
                                        <div style={tileStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>Claim status</div>
                                            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{formatClaimStatus(checkoutData.claim_status)}</div>
                                        </div>
                                        <div style={tileStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>Current holder</div>
                                            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                                                {checkoutData.registration_type === 'gift'
                                                    ? (checkoutData.is_demo ? 'Demo buyer (you)' : 'Buyer (you)')
                                                    : 'You'}
                                            </div>
                                        </div>
                                        <div style={tileStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>Certificate</div>
                                            <div style={{ fontSize: '1.32rem', fontWeight: 700 }}>{checkoutData.certificate_label}</div>
                                        </div>
                                        <div style={tileStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>Delivery</div>
                                            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{getDeliveryLabel(checkoutData)}</div>
                                        </div>
                                        <div style={tileStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>What happens next</div>
                                            <p className="muted-copy">
                                                {checkoutData.registration_type === 'gift'
                                                    ? 'Your StarWiki page and private ownership page stay available in your account. The recipient can view the gift first and claim it later.'
                                                    : 'Your StarWiki page and private ownership page stay available in your account. If you ever want to hand this star over later, you can prepare a claim link from the ownership page.'}
                                            </p>
                                        </div>
                                    </aside>
                                </div>
                            </section>

                            <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.08fr 0.92fr', gap: px(26) }}>
                                <div className="glass-card" style={{ padding: `${px(34)}px ${px(36)}px` }}>
                                    <p className="eyebrow" style={{ marginBottom: 16 }}>Certificate Access</p>
                                    <h2 style={{ fontSize: 'clamp(1.9rem, 3vw, 3rem)', marginBottom: 14 }}>
                                        Your certificate is part of the registry record
                                    </h2>
                                    <p className="muted-copy" style={{ marginBottom: 26, maxWidth: 760 }}>
                                        Use the star page as your main home for this record, then return to the certificate and receipt whenever you need to revisit the purchase, confirm fulfilment, or share the registration.
                                    </p>

                                    {order ? (
                                        <CertificatePreview order={order} />
                                    ) : (
                                        <div className="status-banner">Your certificate preview will appear here once the order details finish loading.</div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gap: px(22) }}>
                                    <section className="glass-card" style={{ padding: cardPadding }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Purchased Record</p>
                                        <div className="status-grid">
                                            <div className="status-tile">
                                                <div>
                                                    <strong>Registered to</strong>
                                                    <p>{checkoutData.owner_name}</p>
                                                </div>
                                            </div>
                                            {checkoutData.recipient_name ? (
                                                <div className="status-tile">
                                                    <div>
                                                        <strong>Recipient</strong>
                                                        <p>{checkoutData.recipient_name}</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className="status-tile">
                                                <div>
                                                    <strong>Star</strong>
                                                    <p>{checkoutData.star_name}</p>
                                                </div>
                                            </div>
                                            <div className="status-tile">
                                                <div>
                                                    <strong>Issued on</strong>
                                                    <p>{formatDate(order?.fulfilled_at || order?.created_at || checkoutData.fulfilled_at)}</p>
                                                </div>
                                            </div>
                                            <div className="status-tile">
                                                <div>
                                                    <strong>Gift status</strong>
                                                    <p>{formatClaimStatus(checkoutData.claim_status)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {checkoutData.registration_type === 'gift' ? (
                                            <div className="status-banner" style={{ marginTop: 16 }}>
                                                {checkoutData.recipient_name
                                                    ? `You are managing this star until ${checkoutData.recipient_name} claims it.`
                                                    : 'You are managing this star until the recipient claims it.'}
                                            </div>
                                        ) : null}
                                        {checkoutData.registration_type === 'gift' && !order?.recipient_email ? (
                                            <div className="status-banner" style={{ marginTop: 12 }}>
                                                No recipient email was added. You can copy the claim link and send it manually.
                                            </div>
                                        ) : null}
                                        {checkoutData.registration_type === 'gift' && order?.recipient_email ? (
                                            <div className="status-banner" style={{ marginTop: 12 }}>
                                                Recipient email saved. Email invitation can be sent later.
                                            </div>
                                        ) : null}
                                    </section>

                                    <section className="glass-card" style={{ padding: cardPadding }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Next Actions</p>
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            {ownedStarPath ? (
                                                <Link to={ownedStarPath} className="secondary-button">
                                                    Open star page
                                                </Link>
                                            ) : null}
                                            {checkoutData.public_page_slug ? (
                                                <Link to={`/starwiki/${checkoutData.public_page_slug}`} className="secondary-button">
                                                    Open public star page
                                                </Link>
                                            ) : null}
                                            <Link to="/account?section=stars" className="secondary-button">
                                                Browse my stars
                                            </Link>
                                            <Link to="/account?section=orders" className="secondary-button">
                                                View orders and receipts
                                            </Link>
                                        </div>
                                    </section>
                                </div>
                            </section>
                        </>
                    ) : null}

                    {status === 'pending' && checkoutData ? (
                        <section className="glass-card" style={{ padding: '42px 40px', textAlign: 'center' }}>
                            <div className="eyebrow" style={{ marginBottom: 18 }}>Checkout Not Finished</div>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: 16 }}>Your payment is not complete yet</h1>
                            <p className="muted-copy" style={{ maxWidth: 680, margin: '0 auto 26px' }}>
                                Stripe returned a status of {checkoutData.status}. Head back to the registry and try again when you&apos;re ready.
                            </p>
                            <Link to="/buy" className="secondary-button" style={{ width: 'auto', minWidth: '220px', margin: '0 auto' }}>
                                Back to the Registry
                            </Link>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '42px 40px', textAlign: 'center' }}>
                            <div className="eyebrow" style={{ marginBottom: 18 }}>Checkout Error</div>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: 16 }}>We couldn&apos;t confirm that purchase</h1>
                            <p className="muted-copy" style={{ maxWidth: 680, margin: '0 auto 26px' }}>{error}</p>
                            <Link to="/buy" className="secondary-button" style={{ width: 'auto', minWidth: '220px', margin: '0 auto' }}>
                                Back to the Registry
                            </Link>
                        </section>
                    ) : null}
                </div>
            </section>
            <Footer />
        </>
    );
};

export default CheckoutCompletePage;
