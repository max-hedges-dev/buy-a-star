import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import CertificatePreview from '../components/CertificatePreview';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOrder, updateOwnedStarPrice } from '../services/api';
import { downloadCertificate } from '../utils/certificateDownload';
import {
    formatDate,
    formatMoney,
    formatOrderStatus,
    getDeliveryLabel,
    getPublicStarPath,
    getStarDisplayName,
    getVisibilityLabel,
} from '../utils/ownership';
import { getSpectralDisplay } from '../utils/starAppearance';

const pageStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top right, rgba(255,77,0,0.18), transparent 24%), radial-gradient(circle at left center, rgba(0,188,212,0.12), transparent 22%), linear-gradient(180deg, #040404 0%, #020202 100%)',
};

const actionButtonStyle = {
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

const sectionCardStyle = {
    padding: '28px 30px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const metricCardStyle = {
    padding: '18px 20px',
    borderRadius: 22,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const detailItemStyle = {
    padding: '16px 0',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 18,
    alignItems: 'flex-start',
};

const formatSterling = (amount) => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
}).format(amount || 0);

const OwnedStarPage = () => {
    const { transactionId } = useParams();
    const [order, setOrder] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [ownerPriceInput, setOwnerPriceInput] = useState('');
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [priceMessage, setPriceMessage] = useState('');
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 980 });

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const response = await fetchAccountOrder(transactionId);
                setOrder(response);
                setOwnerPriceInput(response.star.ask_price ? response.star.ask_price.toFixed(2) : '');
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadOrder();
    }, [transactionId]);

    const shareLink = useMemo(() => {
        if (!order) {
            return '';
        }

        return `${window.location.origin}${getPublicStarPath(order.star)}`;
    }, [order]);
    const spectralDisplay = useMemo(() => (order ? getSpectralDisplay(order.star) : null), [order]);
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const heroPadding = `${px(42)}px ${px(40)}px`;
    const cardPadding = `${px(28)}px ${px(30)}px`;
    const wideCardPadding = `${px(34)}px ${px(36)}px`;
    const actionStyle = {
        width: isNarrow ? '100%' : 'fit-content',
        minWidth: isNarrow ? 0 : 220,
    };

    const handleCopyLink = async () => {
        if (!shareLink) {
            return;
        }

        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const handleDownloadCertificate = async () => {
        if (!order) {
            return;
        }

        try {
            setIsDownloading(true);
            await downloadCertificate(order);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSaveOwnerPrice = async () => {
        if (!order) {
            return;
        }

        const normalizedValue = ownerPriceInput.trim();
        const parsedValue = normalizedValue === '' ? null : Number(normalizedValue);
        if (normalizedValue !== '' && (!Number.isFinite(parsedValue) || parsedValue <= 0)) {
            setPriceMessage('Enter a valid owner price or clear the field to remove it.');
            return;
        }

        try {
            setIsSavingPrice(true);
            const updated = await updateOwnedStarPrice(order.star.id, parsedValue);
            setOrder((currentOrder) => (
                currentOrder
                    ? {
                        ...currentOrder,
                        star: {
                            ...currentOrder.star,
                            ask_price: updated.ask_price,
                            model_value: updated.model_value ?? currentOrder.star.model_value,
                        },
                    }
                    : currentOrder
            ));
            setOwnerPriceInput(updated.ask_price ? updated.ask_price.toFixed(2) : '');
            setPriceMessage(updated.ask_price ? 'Owner price updated.' : 'Owner price removed.');
        } catch (requestError) {
            setPriceMessage(requestError.message || 'We could not update the owner price.');
        } finally {
            setIsSavingPrice(false);
        }
    };

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `${px(124)}px ${pagePaddingX}px ${px(80)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '40px' }}>
                            <p className="eyebrow" style={{ marginBottom: 16 }}>Ownership Page</p>
                            <h1 style={{ fontSize: 'clamp(2.1rem, 4vw, 3.8rem)', marginBottom: 14 }}>
                                Loading your star ownership page
                            </h1>
                            <p className="muted-copy">We&apos;re preparing the ownership details and certificate access for this registration.</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '40px' }}>
                            <p className="eyebrow" style={{ marginBottom: 16 }}>Ownership Page</p>
                            <h1 style={{ fontSize: 'clamp(2.1rem, 4vw, 3.8rem)', marginBottom: 14 }}>
                                We couldn&apos;t load that star page
                            </h1>
                            <p className="muted-copy" style={{ marginBottom: 26 }}>{error}</p>
                            <Link to="/account" className="secondary-button" style={{ width: 'fit-content', minWidth: 220 }}>
                                Back to Account
                            </Link>
                        </section>
                    ) : null}

                    {status === 'ready' && order ? (
                        <>
                            <section className="glass-card" style={{ padding: heroPadding }}>
                                <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.35fr 0.95fr', gap: px(28), alignItems: 'start' }}>
                                    <div>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Ownership Page</p>
                                        <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.4rem)', lineHeight: 0.96, marginBottom: 16 }}>
                                            {getStarDisplayName(order.star)}
                                        </h1>
                                        <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 26 }}>
                                            This is the core ownership page for your registered star. The registration is held in the name of {order.owner_name}, recorded under {order.registration_number}, and can be revisited anytime from your account.
                                        </p>

                                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
                                            <Link to={getPublicStarPath(order.star)} style={actionButtonStyle}>
                                                View in Galaxy
                                            </Link>
                                            <button type="button" className="secondary-button" style={actionStyle} onClick={handleCopyLink}>
                                                {copied ? 'Registry Link Copied' : 'Copy Registry Link'}
                                            </button>
                                        </div>

                                        <div className="status-grid">
                                            <div style={metricCardStyle}>
                                                <div className="eyebrow" style={{ marginBottom: 10 }}>Owned By</div>
                                                <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{order.owner_name}</div>
                                            </div>
                                            <div style={metricCardStyle}>
                                                <div className="eyebrow" style={{ marginBottom: 10 }}>Registered</div>
                                                <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{formatDate(order.fulfilled_at || order.created_at)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <aside style={{ ...sectionCardStyle, padding: cardPadding, background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))' }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Registry Record</p>
                                        <div style={{ display: 'grid', gap: 2 }}>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>{order.registration_number}</div>
                                            <p className="muted-copy" style={{ marginBottom: 10 }}>{getVisibilityLabel()}</p>
                                        </div>

                                        <div style={detailItemStyle}>
                                            <span style={{ color: 'rgba(255,255,255,0.62)' }}>Scientific name</span>
                                            <strong style={{ textAlign: 'right' }}>{order.star.scientific_name}</strong>
                                        </div>
                                        <div style={detailItemStyle}>
                                            <span style={{ color: 'rgba(255,255,255,0.62)' }}>Constellation</span>
                                            <strong style={{ textAlign: 'right' }}>{order.star.constellation || 'Not listed'}</strong>
                                        </div>
                                        <div style={detailItemStyle}>
                                            <span style={{ color: 'rgba(255,255,255,0.62)' }}>Distance</span>
                                            <strong style={{ textAlign: 'right' }}>{order.star.distance_ly.toFixed(2)} light years</strong>
                                        </div>
                                        {spectralDisplay ? (
                                            <div style={detailItemStyle}>
                                                <span style={{ color: 'rgba(255,255,255,0.62)' }}>{spectralDisplay.label}</span>
                                                <strong style={{ textAlign: 'right' }}>{spectralDisplay.value}</strong>
                                            </div>
                                        ) : null}
                                        <div style={detailItemStyle}>
                                            <span style={{ color: 'rgba(255,255,255,0.62)' }}>Delivery</span>
                                            <strong style={{ textAlign: 'right' }}>{getDeliveryLabel(order)}</strong>
                                        </div>
                                    </aside>
                                </div>
                            </section>

                            <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.18fr 0.82fr', gap: px(26) }}>
                                <div className="glass-card" style={{ padding: wideCardPadding }}>
                                    <p className="eyebrow" style={{ marginBottom: 16 }}>Certificate Access</p>
                                    <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 3rem)', marginBottom: 14 }}>
                                        Your certificate is part of the ownership record
                                    </h2>
                                    <p className="muted-copy" style={{ marginBottom: 26, maxWidth: 760 }}>
                                        Use this page as your ownership home, then open the full certificate and order record whenever you need to revisit the purchase, confirm fulfilment, or share the registration.
                                    </p>

                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            style={actionStyle}
                                            onClick={handleDownloadCertificate}
                                        >
                                            {isDownloading ? 'Preparing Download...' : 'Download Certificate'}
                                        </button>
                                    </div>

                                    <CertificatePreview order={order} />
                                </div>

                                <div style={{ display: 'grid', gap: px(22) }}>
                                    <section className="glass-card" style={{ padding: cardPadding }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Astronomy Snapshot</p>
                                        <div style={{ display: 'grid', gap: 16 }}>
                                            <div>
                                                <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 6 }}>Category</div>
                                                <strong>{order.star.category}</strong>
                                            </div>
                                            <div>
                                                <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 6 }}>Constellation</div>
                                                <strong>{order.star.constellation || 'Not listed'}</strong>
                                            </div>
                                            <div>
                                                <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 6 }}>Distance from Earth</div>
                                                <strong>{order.star.distance_ly.toFixed(2)} light years</strong>
                                            </div>
                                            {spectralDisplay ? (
                                                <div>
                                                    <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 6 }}>{spectralDisplay.label}</div>
                                                    <strong>{spectralDisplay.value}</strong>
                                                </div>
                                            ) : null}
                                        </div>
                                    </section>

                                    <section className="glass-card" style={{ padding: cardPadding }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Marketplace Price</p>
                                        <div style={{ display: 'grid', gap: 16 }}>
                                            <div>
                                                <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 6 }}>Predicted price</div>
                                                <strong style={{ fontSize: '1.35rem' }}>
                                                    {typeof order.star.model_value === 'number' ? formatSterling(order.star.model_value) : 'Pending'}
                                                </strong>
                                            </div>
                                            <div>
                                                <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 8 }}>Owner price</div>
                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={ownerPriceInput}
                                                        onChange={(event) => {
                                                            setOwnerPriceInput(event.target.value);
                                                            setPriceMessage('');
                                                        }}
                                                        placeholder="Set your price"
                                                        style={{
                                                            flex: '1 1 180px',
                                                            minWidth: 0,
                                                            padding: '13px 14px',
                                                            borderRadius: 16,
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                            background: 'rgba(255,255,255,0.04)',
                                                            color: 'white',
                                                        }}
                                                    />
                                                    <button type="button" className="secondary-button" onClick={handleSaveOwnerPrice}>
                                                        {isSavingPrice ? 'Saving...' : 'Save Owner Price'}
                                                    </button>
                                                </div>
                                                <div style={{ color: 'rgba(255,255,255,0.62)', marginTop: 10 }}>
                                                    {order.star.ask_price ? `Current owner price: ${formatSterling(order.star.ask_price)}` : 'No owner price set yet.'}
                                                </div>
                                                {priceMessage ? (
                                                    <div style={{ color: 'rgba(255,255,255,0.72)', marginTop: 8 }}>{priceMessage}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="glass-card" style={{ padding: cardPadding }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Ownership Actions</p>
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            <Link to="/account?section=orders" className="secondary-button">
                                                Review all orders
                                            </Link>
                                            <Link to="/account?section=stars" className="secondary-button">
                                                Return to account hub
                                            </Link>
                                        </div>
                                    </section>

                                    <section className="glass-card" style={{ padding: cardPadding }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Order Record</p>
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            <div style={{ color: 'rgba(255,255,255,0.62)' }}>Receipt total</div>
                                            <strong style={{ fontSize: '1.4rem' }}>{formatMoney(order.amount, order.currency)}</strong>
                                            <div style={{ color: 'rgba(255,255,255,0.62)', marginTop: 8 }}>Certificate type</div>
                                            <strong>{order.certificate_label}</strong>
                                        </div>
                                    </section>
                                </div>
                            </section>
                        </>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default OwnedStarPage;
