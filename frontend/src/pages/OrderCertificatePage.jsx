import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import CertificatePreview from '../components/CertificatePreview';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOrder } from '../services/api';
import {
    formatDate,
    formatDateTime,
    formatMoney,
    formatOrderStatus,
    getDeliveryLabel,
    getOwnedStarPath,
    getPublicStarPath,
} from '../utils/ownership';
import { getSpectralDisplay } from '../utils/starAppearance';

const pageStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top right, rgba(255,77,0,0.14), transparent 24%), radial-gradient(circle at left center, rgba(0,188,212,0.1), transparent 22%), linear-gradient(180deg, #040404 0%, #020202 100%)',
};

const sectionCardStyle = {
    padding: '28px 30px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const primaryButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '15px 20px',
    borderRadius: 999,
    background: 'var(--cta-gradient)',
    color: '#070a11',
    fontWeight: 700,
    letterSpacing: '0.04em',
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 18px 40px rgba(255,91,22,0.22)',
};

const OrderCertificatePage = () => {
    const { transactionId } = useParams();
    const [order, setOrder] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 960 });
    const spectralDisplay = useMemo(() => (order ? getSpectralDisplay(order.star) : null), [order]);
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const heroPadding = `${px(34)}px ${px(36)}px`;
    const cardPadding = `${px(28)}px ${px(30)}px`;
    const isPendingCheckout = order?.status === 'checkout_created';
    const resumeCheckoutPath = order ? `/search/${order.star.star_slug}?checkout=1&cart=${order.id}` : '/account/cart';
    const actionStyle = {
        width: isNarrow ? '100%' : 'fit-content',
        minWidth: isNarrow ? 0 : 220,
    };

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const response = await fetchAccountOrder(transactionId);
                setOrder(response);
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadOrder();
    }, [transactionId]);

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `${px(124)}px ${pagePaddingX}px ${px(72)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(28) }}>
                    <section className="glass-card" style={{ padding: heroPadding }}>
                        <div style={{ width: 74, height: 1, marginBottom: 24, background: 'rgba(255,255,255,0.78)' }} />
                        <p className="eyebrow" style={{ marginBottom: 16 }}>Order Record</p>

                        {status === 'loading' ? (
                            <>
                                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 14 }}>
                                    Preparing your order record
                                </h1>
                                <p className="muted-copy">Loading the star page, certificate, and receipt details for this registration.</p>
                            </>
                        ) : null}

                        {status === 'error' ? (
                            <>
                                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 14 }}>
                                    We couldn&apos;t load that order
                                </h1>
                                <p className="muted-copy" style={{ marginBottom: 24 }}>{error}</p>
                                <Link to="/account?section=orders" className="secondary-button" style={{ width: 'fit-content', minWidth: 220 }}>
                                    Back to Orders
                                </Link>
                            </>
                        ) : null}

                        {status === 'ready' && order ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.12fr 0.88fr', gap: px(28), alignItems: 'start' }}>
                                    <div>
                                        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.8rem)', marginBottom: 14 }}>
                                            Order record for {order.star.display_name}
                                        </h1>
                                        <p className="muted-copy" style={{ maxWidth: 760, marginBottom: 24 }}>
                                            {isPendingCheckout
                                                ? 'This star is still in your cart and waiting for payment. Complete checkout to turn this hold into a finished registration.'
                                                : `This page combines the certificate preview, registry details, and purchase record for registration ${order.registration_number}.`}
                                        </p>
                                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                            {isPendingCheckout ? (
                                                <Link to={resumeCheckoutPath} style={primaryButtonStyle}>
                                                    Proceed to payment
                                                </Link>
                                            ) : null}
                                            <Link to={getPublicStarPath(order.star)} className="secondary-button" style={actionStyle}>
                                                Open star page
                                            </Link>
                                            <Link
                                                to="/search"
                                                state={{
                                                    preserveTarget: true,
                                                    focusStarSlug: order.star.star_slug,
                                                    macroFlyInMode: true,
                                                    targetZoomScale: 0.2,
                                                }}
                                                className="secondary-button"
                                                style={actionStyle}
                                            >
                                                View in atlas
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="status-grid">
                                        <div className="status-tile">
                                            <div>
                                                <strong>Order status</strong>
                                                <p>{formatOrderStatus(order.status)}</p>
                                            </div>
                                        </div>
                                        <div className="status-tile">
                                            <div>
                                                <strong>Total paid</strong>
                                                <p>{formatMoney(order.amount, order.currency)}</p>
                                            </div>
                                        </div>
                                        <div className="status-tile">
                                            <div>
                                                <strong>Certificate</strong>
                                                <p>{order.certificate_label}</p>
                                            </div>
                                        </div>
                                        <div className="status-tile">
                                            <div>
                                                <strong>Delivery</strong>
                                                <p>{getDeliveryLabel(order)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </section>

                    {status === 'ready' && order && !isPendingCheckout ? (
                        <section style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.08fr 0.92fr', gap: px(28) }}>
                            <div className="glass-card" style={{ padding: heroPadding }}>
                                <p className="eyebrow" style={{ marginBottom: 16 }}>Certificate Preview</p>
                                <h2 style={{ fontSize: 'clamp(1.9rem, 3vw, 3rem)', marginBottom: 14 }}>
                                    The certificate attached to this order
                                </h2>
                                <p className="muted-copy" style={{ maxWidth: 760, marginBottom: 26 }}>
                                    This preview reflects the registry name and star recorded against the purchase.
                                </p>

                                <CertificatePreview order={order} />
                            </div>

                            <div style={{ display: 'grid', gap: px(22) }}>
                                <section className="glass-card" style={{ ...sectionCardStyle, padding: cardPadding }}>
                                    <p className="eyebrow" style={{ marginBottom: 16 }}>Registry Details</p>
                                    <div className="profile-meta">
                                        <div>
                                            <span>Registered owner</span>
                                            <strong>{order.owner_name}</strong>
                                        </div>
                                        <div>
                                            <span>Registration number</span>
                                            <strong>{order.registration_number}</strong>
                                        </div>
                                        <div>
                                            <span>Issued on</span>
                                            <strong>{formatDate(order.fulfilled_at || order.created_at)}</strong>
                                        </div>
                                        <div>
                                            <span>Star</span>
                                            <strong>{order.star.display_name}</strong>
                                        </div>
                                    </div>
                                </section>

                                <section className="glass-card" style={{ ...sectionCardStyle, padding: cardPadding }}>
                                    <p className="eyebrow" style={{ marginBottom: 16 }}>Astronomy Details</p>
                                    <div className="profile-meta">
                                        <div>
                                            <span>Scientific name</span>
                                            <strong>{order.star.scientific_name}</strong>
                                        </div>
                                        <div>
                                            <span>Category</span>
                                            <strong>{order.star.category}</strong>
                                        </div>
                                        <div>
                                            <span>Constellation</span>
                                            <strong>{order.star.constellation || 'Not listed'}</strong>
                                        </div>
                                        {spectralDisplay ? (
                                            <div>
                                                <span>{spectralDisplay.label}</span>
                                                <strong>{spectralDisplay.value}</strong>
                                            </div>
                                        ) : null}
                                        <div>
                                            <span>Distance</span>
                                            <strong>{order.star.distance_ly.toFixed(2)} light years</strong>
                                        </div>
                                    </div>
                                </section>

                                <section className="glass-card" style={{ ...sectionCardStyle, padding: cardPadding }}>
                                    <p className="eyebrow" style={{ marginBottom: 16 }}>Receipt</p>
                                    <div className="profile-meta">
                                        <div>
                                            <span>Order ID</span>
                                            <strong>#{order.id}</strong>
                                        </div>
                                        <div>
                                            <span>Order timestamp</span>
                                            <strong>{formatDateTime(order.created_at)}</strong>
                                        </div>
                                        <div>
                                            <span>Certificate type</span>
                                            <strong>{order.certificate_label}</strong>
                                        </div>
                                        <div>
                                            <span>Charge amount</span>
                                            <strong>{formatMoney(order.amount, order.currency)}</strong>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </section>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default OrderCertificatePage;
