import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import EmbeddedStripeCheckout from '../components/EmbeddedStripeCheckout';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOverview, createBulkCheckoutSession } from '../services/api';
import { formatMoney, getStarDisplayName } from '../utils/ownership';

const pageStyle = {
    minHeight: '100vh',
    background: `
        radial-gradient(circle at top center, rgba(255,101,24,0.18), transparent 24%),
        radial-gradient(circle at 14% 24%, rgba(0,188,212,0.11), transparent 20%),
        linear-gradient(180deg, #040404 0%, #090909 100%)
    `,
};

const panelStyle = {
    padding: '30px 32px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '15px',
    borderRadius: '14px',
    border: '1px solid rgba(245,239,226,0.14)',
    background: 'rgba(7,10,17,0.76)',
    color: 'white',
    fontSize: '1rem',
};

const BulkCartCheckoutPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 920 });
    const ids = useMemo(
        () => (searchParams.get('items') || '')
            .split(',')
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((value) => Number.isInteger(value)),
        [searchParams]
    );

    const [status, setStatus] = useState('loading');
    const [items, setItems] = useState([]);
    const [ownerName, setOwnerName] = useState('');
    const [dedication, setDedication] = useState('');
    const [giftMessage, setGiftMessage] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const overview = await fetchAccountOverview();
                const selectedItems = (overview.cart_items || []).filter((item) => ids.includes(item.id));
                setItems(selectedItems);
                if (selectedItems[0]) {
                    setOwnerName(selectedItems[0].owner_name || '');
                    setDedication(selectedItems[0].dedication || '');
                    setGiftMessage(selectedItems[0].gift_message || '');
                }
                setStatus('ready');
            } catch (error) {
                setCheckoutError(error.message);
                setStatus('error');
            }
        };

        load();
    }, [ids]);

    const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const heroPadding = `${px(42)}px ${px(40)}px`;

    const createSession = async () => {
        return createBulkCheckoutSession({
            transactionIds: items.map((item) => item.id),
            ownerName,
            dedication,
            giftMessage,
            acceptedTerms,
            acceptedPrivacy,
        });
    };

    const handleStartCheckout = () => {
        if (!ownerName.trim()) {
            setCheckoutError('Please choose the shared registered display name for these stars.');
            return;
        }
        if (!acceptedTerms || !acceptedPrivacy) {
            setCheckoutError('Please accept the Terms & Conditions and Privacy Notice before continuing.');
            return;
        }
        setCheckoutError('');
        setIsCheckoutOpen(true);
    };

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `calc(var(--nav-height) + ${px(42)}px) ${pagePaddingX}px ${px(90)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    <section className="glass-card" style={{ padding: heroPadding }}>
                        <p className="eyebrow" style={{ marginBottom: 16 }}>Bulk checkout</p>
                        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.95, marginBottom: 16 }}>
                            Checkout these stars together.
                        </h1>
                        <p className="muted-copy" style={{ maxWidth: 760 }}>
                            Buying multiple stars in one go means the same registered display name, dedication, and message will be applied across all selected stars. You can edit each one separately later from its ownership page after purchase.
                        </p>
                    </section>

                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: heroPadding }}>
                            <p className="muted-copy">Loading your selected cart stars...</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: heroPadding }}>
                            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>We couldn&apos;t prepare this checkout</h2>
                            <p className="muted-copy" style={{ marginBottom: 20 }}>{checkoutError}</p>
                            <Link to="/account/cart" className="secondary-button">Back to cart</Link>
                        </section>
                    ) : null}

                    {status === 'ready' ? (
                        <>
                            <section className="glass-card" style={{ padding: heroPadding }}>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <div className="status-banner" style={{ background: 'rgba(216,168,95,0.12)', border: '1px solid rgba(216,168,95,0.2)' }}>
                                        This shared checkout applies one owner name and one message set to all {items.length} selected stars.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.1fr 0.9fr', gap: 18 }}>
                                        <label style={{ display: 'grid', gap: 8 }}>
                                            <span className="eyebrow">Registered display name for all selected stars</span>
                                            <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} style={inputStyle} />
                                        </label>
                                        <div style={panelStyle}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Total</div>
                                            <strong style={{ fontSize: '1.6rem' }}>{formatMoney(totalAmount, 'gbp')}</strong>
                                        </div>
                                    </div>
                                    <label style={{ display: 'grid', gap: 8 }}>
                                        <span className="eyebrow">Shared dedication</span>
                                        <textarea value={dedication} onChange={(event) => setDedication(event.target.value)} rows={4} style={inputStyle} />
                                    </label>
                                    <label style={{ display: 'grid', gap: 8 }}>
                                        <span className="eyebrow">Shared message</span>
                                        <textarea value={giftMessage} onChange={(event) => setGiftMessage(event.target.value)} rows={4} style={inputStyle} />
                                    </label>
                                    <div style={{ display: 'grid', gap: 10 }}>
                                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                                            <span>I accept the Terms & Conditions for all selected stars.</span>
                                        </label>
                                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} />
                                            <span>I accept the Privacy Notice for all selected stars.</span>
                                        </label>
                                    </div>
                                    {checkoutError ? <div className="status-banner status-banner-error">{checkoutError}</div> : null}
                                    {!isCheckoutOpen ? (
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            <button type="button" className="primary-button" onClick={handleStartCheckout}>
                                                Proceed to payment for {items.length} stars
                                            </button>
                                            <Link to="/account/cart" className="secondary-button">
                                                Back to cart
                                            </Link>
                                        </div>
                                    ) : null}
                                </div>
                            </section>

                            <section className="glass-card" style={{ padding: heroPadding }}>
                                <p className="eyebrow" style={{ marginBottom: 12 }}>Selected stars</p>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {items.map((item) => (
                                        <div key={item.id} style={panelStyle}>
                                            <strong style={{ display: 'block', marginBottom: 8 }}>{getStarDisplayName(item.star)}</strong>
                                            <span className="muted-copy">{formatMoney(item.amount, item.currency)} · cart item #{item.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {isCheckoutOpen ? (
                                <section className="glass-card" style={{ padding: heroPadding }}>
                                    <div className="status-banner" style={{ marginBottom: 18 }}>
                                        This bulk checkout will apply the shared owner name and message shown above to all selected stars. You can still customise each star later from its ownership page once purchased.
                                    </div>
                                    <EmbeddedStripeCheckout
                                        createSession={createSession}
                                        onComplete={(sessionId) => navigate(`/checkout/complete?session_id=${encodeURIComponent(sessionId)}`)}
                                        onError={(message) => setCheckoutError(message)}
                                    />
                                </section>
                            ) : null}
                        </>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default BulkCartCheckoutPage;
