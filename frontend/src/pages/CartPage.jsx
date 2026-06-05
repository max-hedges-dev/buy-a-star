import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock3, ShoppingCart } from 'lucide-react';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOverview } from '../services/api';
import {
    formatDate,
    formatDateTime,
    formatMoney,
    getPublicStarPath,
    getStarDisplayName,
    getUserInitials,
} from '../utils/ownership';
import { useAuth } from '../hooks/useAuth';

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

const recordCardStyle = {
    padding: '24px 24px 22px',
    borderRadius: 24,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: 18,
};

const summaryTileStyle = {
    padding: '18px 20px',
    borderRadius: 22,
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

const emptyStateStyle = {
    ...panelStyle,
    textAlign: 'center',
    padding: '42px 36px',
};

const HOLD_REFRESH_MS = 1000;

const getRemainingTime = (holdExpiresAt, now) => {
    if (!holdExpiresAt) {
        return null;
    }

    const remainingMs = new Date(holdExpiresAt).getTime() - now;
    if (remainingMs <= 0) {
        return null;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s remaining`;
    }

    return `${minutes}m ${seconds}s remaining`;
};

const CartPage = () => {
    const location = useLocation();
    const { user } = useAuth();
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [overview, setOverview] = useState({ cart_items: [], orders: [], stars: [] });
    const [now, setNow] = useState(Date.now());
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
        const intervalId = window.setInterval(() => {
            setNow(Date.now());
        }, HOLD_REFRESH_MS);

        return () => window.clearInterval(intervalId);
    }, []);

    const cartItems = overview.cart_items || [];
    const userName = user?.username || user?.full_name || user?.email?.split('@')[0] || 'Aster Atlas collector';
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const cardPadding = `${px(30)}px ${px(32)}px`;
    const heroPadding = `${px(42)}px ${px(40)}px`;
    const successBanner = location.state?.justAdded
        ? 'Added to your cart. This star is now held for you for one hour unless you leave it unpaid.'
        : '';

    const itemsWithTimers = useMemo(
        () => cartItems.map((item) => ({
            ...item,
            remainingTime: getRemainingTime(item.hold_expires_at, now),
        })),
        [cartItems, now]
    );

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `calc(var(--nav-height) + ${px(42)}px) ${pagePaddingX}px ${px(90)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    <section className="glass-card" style={{ padding: heroPadding }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.2fr 0.8fr', gap: px(28), alignItems: 'stretch' }}>
                            <div>
                                <p className="eyebrow" style={{ marginBottom: 16 }}>Cart</p>
                                <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.95, marginBottom: 16 }}>
                                    Your cart.
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 22 }}>
                                    Save a star here to hold it for one hour while you decide. If the timer expires, the star stays in your cart, but other people can register it again.
                                </p>
                                {successBanner ? (
                                    <div className="status-banner" style={{ maxWidth: 720 }}>{successBanner}</div>
                                ) : null}
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
                                        <span>Username</span>
                                        <strong>{user?.username || 'Not set yet'}</strong>
                                    </div>
                                    <div>
                                        <span>Cart items</span>
                                        <strong>{cartItems.length}</strong>
                                    </div>
                                    <div>
                                        <span>Registered stars</span>
                                        <strong>{overview.stars?.length || 0}</strong>
                                    </div>
                                    <div>
                                        <span>Orders</span>
                                        <strong>{overview.orders?.length || 0}</strong>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </section>

                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '40px' }}>
                            <p className="eyebrow" style={{ marginBottom: 16 }}>Cart</p>
                            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 12 }}>
                                Loading your saved stars
                            </h2>
                            <p className="muted-copy">Checking your active holds and any unpaid cart items now.</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '40px' }}>
                            <p className="eyebrow" style={{ marginBottom: 16 }}>Cart</p>
                            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 12 }}>
                                We couldn't load your cart
                            </h2>
                            <p className="muted-copy" style={{ marginBottom: 22 }}>{error}</p>
                            <button type="button" className="secondary-button" style={{ width: 'fit-content', minWidth: 220 }} onClick={() => window.location.reload()}>
                                Try Again
                            </button>
                        </section>
                    ) : null}

                    {status === 'ready' && !itemsWithTimers.length ? (
                        <section className="glass-card" style={emptyStateStyle}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>Cart</p>
                            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', marginBottom: 12 }}>Your cart is empty</h2>
                            <p className="muted-copy" style={{ maxWidth: 700, margin: '0 auto 24px' }}>
                                Add a star to your cart to hold it for one hour before checkout.
                            </p>
                            <Link to="/search" className="secondary-button" style={{ width: 'fit-content', minWidth: 220, margin: '0 auto' }}>
                                Find a Star
                            </Link>
                        </section>
                    ) : null}

                    {status === 'ready' && itemsWithTimers.length ? (
                        <section className="glass-card" style={{ padding: cardPadding }}>
                            <div style={{ display: 'grid', gap: 18 }}>
                                {itemsWithTimers.map((item) => {
                                    const resumePath = `/search/${item.star.star_slug}?checkout=1&cart=${item.id}`;
                                    return (
                                        <article key={item.id} style={{ ...recordCardStyle, padding: `${px(24)}px ${px(24)}px ${px(22)}px` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                                <div>
                                                    <p className="eyebrow" style={{ marginBottom: 10 }}>Cart item #{item.id}</p>
                                                    <h2 style={{ fontSize: '1.65rem', marginBottom: 8 }}>{getStarDisplayName(item.star)}</h2>
                                                    <p className="muted-copy">
                                                        {item.hold_active
                                                            ? `Held for you until ${item.hold_expires_at ? formatDateTime(item.hold_expires_at) : 'later today'}`
                                                            : 'Still in your cart, but the one-hour hold has expired and someone else can now register it.'}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: isCompact ? 'left' : 'right', minWidth: isCompact ? 0 : 240 }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.62)', marginBottom: 8 }}>Saved for</div>
                                                    <strong style={{ fontSize: '1.15rem' }}>{item.owner_name || 'Pending details'}</strong>
                                                </div>
                                            </div>

                                            <div className="status-grid">
                                                <div style={summaryTileStyle}>
                                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Status</div>
                                                    <strong>{item.status === 'checkout_created' ? 'Awaiting payment' : item.status}</strong>
                                                </div>
                                                <div style={summaryTileStyle}>
                                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Hold</div>
                                                    <strong>{item.hold_active ? 'Active' : 'Expired'}</strong>
                                                </div>
                                                <div style={summaryTileStyle}>
                                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Time remaining</div>
                                                    <strong>{item.remainingTime || 'Hold expired'}</strong>
                                                </div>
                                                <div style={summaryTileStyle}>
                                                    <div className="eyebrow" style={{ marginBottom: 8 }}>Saved on</div>
                                                    <strong>{formatDate(item.created_at)}</strong>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                <Link to={resumePath} style={primaryButtonStyle}>
                                                    <ShoppingCart size={18} />
                                                    Proceed to payment
                                                </Link>
                                                <Link to={getPublicStarPath(item.star)} className="secondary-button" style={{ width: isNarrow ? '100%' : 'fit-content', minWidth: isNarrow ? 0 : 220 }}>
                                                    Open star page
                                                </Link>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default CartPage;
