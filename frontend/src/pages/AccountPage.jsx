import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOverview } from '../services/api';
import {
    formatDate,
    formatMoney,
    formatOrderStatus,
    getDeliveryLabel,
    getOrderPath,
    getOwnedStarPath,
    getPublicStarPath,
    getStarDisplayName,
    getUserInitials,
} from '../utils/ownership';

const SECTION_CONFIG = [
    {
        id: 'stars',
        label: 'My registered stars',
        title: 'Your registered stars',
        description: 'Star records, certificates, and registry details in one place.',
    },
    {
        id: 'orders',
        label: 'Orders & certificates',
        title: 'Orders and certificates',
        description: 'Payment records, fulfilment progress, and certificate details.',
    },
];

const pageStyle = {
    minHeight: '100vh',
    background: `
        radial-gradient(circle at top center, rgba(255,101,24,0.18), transparent 24%),
        radial-gradient(circle at 14% 24%, rgba(0,188,212,0.11), transparent 20%),
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
        background: 'var(--cta-gradient)',
        color: '#070a11',
    fontWeight: 700,
    letterSpacing: '0.04em',
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 18px 40px rgba(255,91,22,0.22)',
};

const panelStyle = {
    padding: '30px 32px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const navButtonStyle = (isActive) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    minHeight: 118,
    padding: '16px 18px',
    borderRadius: 22,
    background: isActive ? 'linear-gradient(180deg, rgba(255,91,22,0.2), rgba(255,255,255,0.08))' : 'rgba(255,255,255,0.04)',
    border: isActive ? '1px solid rgba(255,123,50,0.42)' : '1px solid rgba(255,255,255,0.08)',
    color: 'white',
    textAlign: 'left',
});

const summaryTileStyle = {
    padding: '18px 20px',
    borderRadius: 22,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const recordCardStyle = {
    padding: '24px 24px 22px',
    borderRadius: 24,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: 18,
};

const emptyStateStyle = {
    ...panelStyle,
    textAlign: 'center',
    padding: '42px 36px',
};

const SectionButton = ({ section, isActive, onClick }) => (
    <button type="button" onClick={onClick} style={navButtonStyle(isActive)}>
        <span className="eyebrow" style={{ color: isActive ? 'var(--primary-strong)' : 'var(--primary-strong)' }}>{section.label}</span>
        <strong style={{ fontSize: '1rem' }}>{section.title}</strong>
        <span style={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>{section.description}</span>
    </button>
);

const EmptyState = ({ eyebrow, title, body, actionTo, actionLabel }) => (
    <section className="glass-card" style={emptyStateStyle}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>{eyebrow}</p>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', marginBottom: 12 }}>{title}</h2>
        <p className="muted-copy" style={{ maxWidth: 700, margin: '0 auto 24px' }}>{body}</p>
        <Link to={actionTo} className="secondary-button" style={{ width: 'fit-content', minWidth: 220, margin: '0 auto' }}>
            {actionLabel}
        </Link>
    </section>
);

const AccountPage = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const sectionParam = searchParams.get('section');
    const activeSection = SECTION_CONFIG.some((section) => section.id === sectionParam) ? sectionParam : 'stars';
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [overview, setOverview] = useState({ orders: [], stars: [] });
    const [downloadingOrderId, setDownloadingOrderId] = useState(null);
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 920 });

    useEffect(() => {
        const loadOverview = async () => {
            try {
                const response = await fetchAccountOverview();
                setOverview(response);
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadOverview();
    }, []);

    useEffect(() => {
        if (!sectionParam || activeSection !== sectionParam) {
            setSearchParams({ section: activeSection }, { replace: true });
        }
    }, [activeSection, sectionParam, setSearchParams]);

    const orders = overview.orders || [];
    const stars = overview.stars || [];

    const fulfilledOrders = useMemo(
        () => orders.filter((order) => order.status === 'fulfilled'),
        [orders]
    );

    const starRecords = useMemo(() => (
        stars.map((star) => ({
            star,
            order: fulfilledOrders.find((order) => order.star.id === star.id) || null,
        }))
    ), [fulfilledOrders, stars]);

    const latestOrder = orders[0] || null;
    const userName = user?.name || user?.email?.split('@')[0] || 'Aster Atlas collector';
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const cardPadding = `${px(30)}px ${px(32)}px`;
    const heroPadding = `${px(42)}px ${px(40)}px`;
    const actionStyle = {
        width: isNarrow ? '100%' : 'fit-content',
        minWidth: isNarrow ? 0 : 220,
    };

    const setSection = (sectionId) => {
        setSearchParams({ section: sectionId });
    };

    const handleDownloadCertificate = async (order) => {
        if (!order) {
            return;
        }

        try {
            setDownloadingOrderId(order.id);
            const { downloadCertificate } = await import('../utils/certificateDownload');
            await downloadCertificate(order);
        } finally {
            setDownloadingOrderId(null);
        }
    };

    const renderStarsSection = () => {
        if (!starRecords.length) {
            return (
                <EmptyState
                    eyebrow="My registered stars"
                    title="No fulfilled stars yet"
                    body="This is where your star records, certificates, and registry details will appear after registration."
                    actionTo="/search"
                    actionLabel="Find a Star"
                />
            );
        }

        return (
            <section className="glass-card" style={{ padding: cardPadding }}>
                <div style={{ display: 'grid', gap: 18 }}>
                    {starRecords.map(({ star, order }) => (
                        <article key={`${star.id}-${order?.id || 'star'}`} style={{ ...recordCardStyle, padding: `${px(24)}px ${px(24)}px ${px(22)}px` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <p className="eyebrow" style={{ marginBottom: 10 }}>Registered Star</p>
                                    <h2 style={{ fontSize: '1.8rem', marginBottom: 8 }}>{getStarDisplayName(star)}</h2>
                                    <p className="muted-copy">
                                        Registered to {star.owner_name || 'Owner pending'} on {formatDate(star.purchase_date || order?.fulfilled_at || order?.created_at)}
                                    </p>
                                </div>
                                <div style={{ minWidth: isCompact ? 0 : 180, textAlign: isCompact ? 'left' : 'right' }}>
                                    <div style={{ color: 'rgba(255,255,255,0.62)', marginBottom: 8 }}>Registration number</div>
                                    <strong style={{ fontSize: '1.1rem' }}>{star.registration_number || order?.registration_number || 'Pending'}</strong>
                                </div>
                            </div>

                            <div className="status-grid">
                                <div style={summaryTileStyle}>
                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Constellation</div>
                                    <strong>{star.constellation || 'Not listed'}</strong>
                                </div>
                                <div style={summaryTileStyle}>
                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Distance</div>
                                    <strong>{star.distance_ly.toFixed(2)} light years</strong>
                                </div>
                                <div style={summaryTileStyle}>
                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Certificate</div>
                                    <strong>{order?.certificate_label || 'Included'}</strong>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {order ? (
                                    <Link to={getOwnedStarPath(order)} style={primaryButtonStyle}>
                                        Open star page
                                    </Link>
                                ) : null}
                                {order ? (
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        style={actionStyle}
                                        onClick={() => handleDownloadCertificate(order)}
                                    >
                                        {downloadingOrderId === order.id ? 'Preparing download...' : 'Download certificate'}
                                    </button>
                                ) : null}
                                <Link to={getPublicStarPath(star)} className="secondary-button" style={actionStyle}>
                                    View in atlas
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        );
    };

    const renderOrdersSection = () => {
        if (!orders.length) {
            return (
                <EmptyState
                    eyebrow="Orders"
                    title="No orders yet"
                    body="Your purchase history, fulfilment progress, and receipts will appear here after checkout."
                    actionTo="/search"
                    actionLabel="Start Exploring"
                />
            );
        }

        return (
            <section className="glass-card" style={{ padding: cardPadding }}>
                <div style={{ display: 'grid', gap: 18 }}>
                    {orders.map((order) => (
                        <article key={order.id} style={{ ...recordCardStyle, padding: `${px(24)}px ${px(24)}px ${px(22)}px` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <p className="eyebrow" style={{ marginBottom: 10 }}>Order #{order.id}</p>
                                    <h2 style={{ fontSize: '1.65rem', marginBottom: 8 }}>{getStarDisplayName(order.star)}</h2>
                                    <p className="muted-copy">
                                        {formatOrderStatus(order.status)} / {order.certificate_label}
                                    </p>
                                </div>
                                <div style={{ textAlign: isCompact ? 'left' : 'right', minWidth: isCompact ? 0 : 180 }}>
                                    <div style={{ color: 'rgba(255,255,255,0.62)', marginBottom: 8 }}>Total paid</div>
                                    <strong style={{ fontSize: '1.3rem' }}>{formatMoney(order.amount, order.currency)}</strong>
                                </div>
                            </div>

                            <div className="status-grid">
                                <div style={summaryTileStyle}>
                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Placed</div>
                                    <strong>{formatDate(order.created_at)}</strong>
                                </div>
                                <div style={summaryTileStyle}>
                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Delivery</div>
                                    <strong>{getDeliveryLabel(order)}</strong>
                                </div>
                                <div style={summaryTileStyle}>
                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Registration</div>
                                    <strong>{order.registration_number || 'Pending'}</strong>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <Link to={getOrderPath(order.id)} style={primaryButtonStyle}>
                                    Open order record
                                </Link>
                                {order.status === 'fulfilled' ? (
                                    <Link to={getOwnedStarPath(order)} className="secondary-button" style={actionStyle}>
                                        Open star page
                                    </Link>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        );
    };

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `calc(var(--nav-height) + ${px(42)}px) ${pagePaddingX}px ${px(90)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    <section className="glass-card" style={{ padding: heroPadding }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.2fr 0.8fr', gap: px(28), alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                                <p className="eyebrow" style={{ marginBottom: 16 }}>Account</p>
                                <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.95, marginBottom: 16 }}>
                                    Your registered stars.
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 26 }}>
                                    This is where your star records, certificates, and registry details live. Return here to open ownership pages, download certificates, and revisit each star in the atlas.
                                </p>

                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: isNarrow ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                                        gap: 12,
                                        alignItems: 'stretch',
                                        marginTop: 'auto',
                                    }}
                                >
                                    {SECTION_CONFIG.map((section) => (
                                        <SectionButton
                                            key={section.id}
                                            section={section}
                                            isActive={section.id === activeSection}
                                            onClick={() => setSection(section.id)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <aside style={{ ...panelStyle, padding: cardPadding, background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                    <div className="avatar-fallback">{getUserInitials(userName)}</div>
                                    <div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>{userName}</div>
                                        <div style={{ color: 'rgba(255,255,255,0.68)' }}>{user?.email || 'Signed in'}</div>
                                    </div>
                                </div>

                                <div className="profile-meta">
                                    <div>
                                        <span>Registered stars</span>
                                        <strong>{stars.length}</strong>
                                    </div>
                                    <div>
                                        <span>Orders</span>
                                        <strong>{orders.length}</strong>
                                    </div>
                                    <div>
                                        <span>Latest order</span>
                                <strong>{latestOrder ? formatDate(latestOrder.created_at) : 'None yet'}</strong>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </section>

                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '40px' }}>
                            <p className="eyebrow" style={{ marginBottom: 16 }}>Loading</p>
                            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 12 }}>
                                Preparing your account
                            </h2>
                            <p className="muted-copy">We&apos;re pulling together your registered stars, certificates, and order history now.</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '40px' }}>
                            <p className="eyebrow" style={{ marginBottom: 16 }}>Account</p>
                            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 12 }}>
                                We couldn&apos;t load your account
                            </h2>
                            <p className="muted-copy" style={{ marginBottom: 22 }}>{error}</p>
                            <button type="button" className="secondary-button" style={{ width: 'fit-content', minWidth: 220 }} onClick={() => window.location.reload()}>
                                Try Again
                            </button>
                        </section>
                    ) : null}

                    {status === 'ready' ? (activeSection === 'orders' ? renderOrdersSection() : renderStarsSection()) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default AccountPage;
