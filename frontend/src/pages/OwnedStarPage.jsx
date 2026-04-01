import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import CertificatePreview from '../components/CertificatePreview';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchAccountOrder } from '../services/api';
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

const OwnedStarPage = () => {
    const { transactionId } = useParams();
    const [order, setOrder] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

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

    const shareLink = useMemo(() => {
        if (!order) {
            return '';
        }

        return `${window.location.origin}${getPublicStarPath(order.star)}`;
    }, [order]);

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

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: '124px 24px 80px' }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 26 }}>
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
                            <section className="glass-card" style={{ padding: '42px 40px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.95fr', gap: 28, alignItems: 'start' }}>
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
                                            <button type="button" className="secondary-button" style={{ width: 'fit-content', minWidth: 220 }} onClick={handleCopyLink}>
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

                                    <aside style={{ ...sectionCardStyle, background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))' }}>
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
                                        <div style={detailItemStyle}>
                                            <span style={{ color: 'rgba(255,255,255,0.62)' }}>Spectral type</span>
                                            <strong style={{ textAlign: 'right' }}>{order.star.spectral_type || 'Not listed'}</strong>
                                        </div>
                                        <div style={detailItemStyle}>
                                            <span style={{ color: 'rgba(255,255,255,0.62)' }}>Delivery</span>
                                            <strong style={{ textAlign: 'right' }}>{getDeliveryLabel(order)}</strong>
                                        </div>
                                    </aside>
                                </div>
                            </section>

                            <section style={{ display: 'grid', gridTemplateColumns: '1.18fr 0.82fr', gap: 26 }}>
                                <div className="glass-card" style={{ padding: '34px 36px' }}>
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
                                            style={{ width: 'fit-content', minWidth: 220 }}
                                            onClick={handleDownloadCertificate}
                                        >
                                            {isDownloading ? 'Preparing Download...' : 'Download Certificate'}
                                        </button>
                                    </div>

                                    <CertificatePreview order={order} />
                                </div>

                                <div style={{ display: 'grid', gap: 22 }}>
                                    <section className="glass-card" style={{ padding: '28px 30px' }}>
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
                                            <div>
                                                <div style={{ color: 'rgba(255,255,255,0.58)', marginBottom: 6 }}>Spectral type</div>
                                                <strong>{order.star.spectral_type || 'Not listed'}</strong>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="glass-card" style={{ padding: '28px 30px' }}>
                                        <p className="eyebrow" style={{ marginBottom: 16 }}>Ownership Actions</p>
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            <Link to="/account?section=orders" className="secondary-button">
                                                Review all orders
                                            </Link>
                                            <Link to="/account?section=overview" className="secondary-button">
                                                Return to account hub
                                            </Link>
                                        </div>
                                    </section>

                                    <section className="glass-card" style={{ padding: '28px 30px' }}>
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
