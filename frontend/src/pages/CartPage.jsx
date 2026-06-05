import React, { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock3, ShoppingCart } from 'lucide-react';

import DetailedStar from '../components/DetailedStar';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchAccountOverview, notifyCartUpdated, removeCartItems } from '../services/api';
import {
    formatDateTime,
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

const compactActionButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0 16px',
    borderRadius: 999,
    border: '1px solid rgba(216,168,95,0.22)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    fontSize: '0.82rem',
    lineHeight: 1,
    height: 46,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
};

const iconToggleButtonStyle = {
    width: 34,
    height: 34,
    minWidth: 34,
    borderRadius: 999,
    border: '1px solid rgba(216,168,95,0.22)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.95rem',
    lineHeight: 1,
};

const hollowCheckStyle = {
    width: 12,
    height: 7,
    borderLeft: '2px solid currentColor',
    borderBottom: '2px solid currentColor',
    transform: 'rotate(-45deg) translateY(-1px)',
};

const emptyStateStyle = {
    ...panelStyle,
    textAlign: 'center',
    padding: '42px 36px',
};

const tooltipStyle = {
    position: 'absolute',
    right: 0,
    bottom: 'calc(100% + 12px)',
    width: 320,
    maxWidth: 'min(320px, 72vw)',
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid rgba(216,168,95,0.22)',
    background: 'linear-gradient(180deg, rgba(28,21,18,0.98) 0%, rgba(16,18,23,0.98) 100%)',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: 1.45,
    boxShadow: '0 18px 38px rgba(0,0,0,0.34), 0 0 0 1px rgba(200,121,58,0.08)',
    zIndex: 30,
    pointerEvents: 'none',
};

const previewShellStyle = {
    width: 150,
    minWidth: 150,
    height: 150,
    borderRadius: 22,
    overflow: 'hidden',
    border: '1px solid rgba(245,239,226,0.08)',
    background: 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.08), transparent 55%), rgba(0,0,0,0.38)',
    position: 'relative',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
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

const getHoldDisplayText = (item, now = Date.now()) => {
    if (!item.is_star_still_available) {
        return 'This star has now been registered by someone else.';
    }
    const liveHoldRemaining = getRemainingTime(item.star?.active_hold_expires_at, now);
    if (item.star?.held_in_another_cart && liveHoldRemaining) {
        return `Another collector is now holding this star until ${formatDateTime(item.star.active_hold_expires_at)}.`;
    }
    const ownHoldRemaining = getRemainingTime(item.hold_expires_at, now);
    if (item.hold_active) {
        return ownHoldRemaining
            ? `Held for you for ${ownHoldRemaining}.`
            : `Held for you until ${item.hold_expires_at ? formatDateTime(item.hold_expires_at) : 'later today'}`;
    }
    return 'Star no longer held. It remains in your cart, but anyone can now register it.';
};

const CartPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [overview, setOverview] = useState({ cart_items: [], orders: [], stars: [] });
    const [now, setNow] = useState(Date.now());
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showBulkWarning, setShowBulkWarning] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [showBlockedProceedTooltip, setShowBlockedProceedTooltip] = useState(false);
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 920 });

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

    useEffect(() => {
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
    const highlightedCartId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const rawValue = params.get('highlight');
        return rawValue ? Number(rawValue) : null;
    }, [location.search]);

    const itemsWithTimers = useMemo(
        () => cartItems.map((item) => ({
            ...item,
            remainingTime: getRemainingTime(item.hold_expires_at, now),
        })),
        [cartItems, now]
    );
    const selectedItems = itemsWithTimers.filter((item) => selectedIds.includes(item.id));
    const allSelected = itemsWithTimers.length > 0 && selectedIds.length === itemsWithTimers.length;
    const hasBlockedSelectedItems = selectedItems.some((item) => !item.can_proceed_to_payment);
    const canBulkProceed = selectedIds.length > 0 && !hasBlockedSelectedItems;
    const blockedProceedMessage = 'You cannot process payment for the stars that are held for another user or registered already.';

    useEffect(() => {
        setSelectedIds((current) => current.filter((id) => cartItems.some((item) => item.id === id)));
    }, [cartItems]);

    useEffect(() => {
        if (!selectionMode) {
            setSelectedIds([]);
        }
    }, [selectionMode]);

    const toggleSelected = (transactionId) => {
        setSelectedIds((current) => (
            current.includes(transactionId)
                ? current.filter((id) => id !== transactionId)
                : [...current, transactionId]
        ));
    };

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : itemsWithTimers.map((item) => item.id));
    };

    const handleToggleSelectionMode = () => {
        setSelectionMode((current) => !current);
        setShowBulkWarning(false);
        setShowBlockedProceedTooltip(false);
    };

    const handleRemoveSelected = async () => {
        if (!selectedIds.length) return;
        try {
            setIsRemoving(true);
            await removeCartItems(selectedIds);
            notifyCartUpdated();
            setOverview((current) => ({
                ...current,
                cart_items: (current.cart_items || []).filter((item) => !selectedIds.includes(item.id)),
            }));
            setSelectedIds([]);
            await loadOverview();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsRemoving(false);
        }
    };

    const handleRemoveSingle = async (event, transactionId) => {
        event.preventDefault();
        event.stopPropagation();
        try {
            setIsRemoving(true);
            await removeCartItems([transactionId]);
            notifyCartUpdated();
            setOverview((current) => ({
                ...current,
                cart_items: (current.cart_items || []).filter((item) => item.id !== transactionId),
            }));
            setSelectedIds((current) => current.filter((id) => id !== transactionId));
            await loadOverview();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setIsRemoving(false);
        }
    };

    const handleBulkProceed = () => {
        if (!canBulkProceed) return;
        if (selectedIds.length === 1) {
            navigate(`/search/${selectedItems[0].star.star_slug}?cart=${selectedItems[0].id}`);
            return;
        }
        setShowBulkWarning(true);
    };

    const confirmBulkProceed = () => {
        setShowBulkWarning(false);
        navigate(`/account/cart/checkout?items=${selectedIds.join(',')}`);
    };

    const shouldShowBlockedProceedTooltip = selectionMode && selectedIds.length > 0 && hasBlockedSelectedItems && showBlockedProceedTooltip;

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
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 16,
                                    flexWrap: 'wrap',
                                    marginBottom: 18,
                                }}
                            >
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={handleToggleSelectionMode}
                                        style={{
                                            ...compactActionButtonStyle,
                                            background: selectionMode ? 'rgba(216,168,95,0.14)' : 'rgba(255,255,255,0.04)',
                                            border: selectionMode ? '1px solid rgba(216,168,95,0.34)' : compactActionButtonStyle.border,
                                        }}
                                    >
                                        {selectionMode ? 'Done selecting' : 'Select stars'}
                                    </button>
                                    {selectionMode ? (
                                        <button type="button" style={compactActionButtonStyle} onClick={toggleSelectAll}>
                                            {allSelected ? 'Unselect all' : 'Select all'}
                                        </button>
                                    ) : null}
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        flexWrap: isNarrow ? 'wrap' : 'nowrap',
                                        justifyContent: 'flex-end',
                                        alignItems: 'center',
                                    }}
                                >
                                    {selectionMode ? (
                                        <>
                                            {selectedIds.length ? (
                                                <button
                                                    type="button"
                                                    style={{
                                                        ...compactActionButtonStyle,
                                                        minWidth: 164,
                                                        opacity: isRemoving ? 0.55 : 1,
                                                        cursor: isRemoving ? 'not-allowed' : 'pointer',
                                                    }}
                                                    onClick={handleRemoveSelected}
                                                    disabled={isRemoving}
                                                >
                                                    {isRemoving ? 'Removing...' : selectedIds.length > 1 ? `Remove ${selectedIds.length} stars` : 'Remove selected star'}
                                                </button>
                                            ) : null}
                                            <div
                                                style={{ position: 'relative', display: 'inline-flex' }}
                                                onMouseEnter={() => {
                                                    if (selectedIds.length && hasBlockedSelectedItems) {
                                                        setShowBlockedProceedTooltip(true);
                                                    }
                                                }}
                                                onMouseMove={() => {
                                                    if (selectedIds.length && hasBlockedSelectedItems) {
                                                        setShowBlockedProceedTooltip(true);
                                                    }
                                                }}
                                                onMouseLeave={() => setShowBlockedProceedTooltip(false)}
                                            >
                                                {shouldShowBlockedProceedTooltip ? (
                                                    <div style={tooltipStyle}>
                                                        {blockedProceedMessage}
                                                    </div>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="primary-button"
                                                    onClick={handleBulkProceed}
                                                    disabled={!canBulkProceed}
                                                    style={{
                                                        height: 46,
                                                        padding: '0 18px',
                                                        boxSizing: 'border-box',
                                                        fontSize: '0.82rem',
                                                        letterSpacing: '0.04em',
                                                        lineHeight: 1,
                                                        fontWeight: 700,
                                                        whiteSpace: 'nowrap',
                                                        opacity: canBulkProceed ? 1 : 0.55,
                                                        cursor: canBulkProceed ? 'pointer' : 'not-allowed',
                                                    }}
                                                >
                                                    {selectedIds.length > 1 ? `Proceed to payment for ${selectedIds.length} stars` : 'Proceed to payment'}
                                                </button>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 18 }}>
                                {itemsWithTimers.map((item) => {
                                    const resumePath = `/search/${item.star.star_slug}?cart=${item.id}`;
                                    const isSelected = selectedIds.includes(item.id);
                                    const isCartLikeStatus = ['checkout_created', 'expired', 'payment_failed'].includes(item.status);
                                    const starAvailable = item.is_star_still_available !== false;
                                    const anotherUserActiveHold = Boolean(item.star?.held_in_another_cart) && starAvailable;
                                    const anotherUserHoldCountdown = anotherUserActiveHold
                                        ? getRemainingTime(item.star?.active_hold_expires_at, now)
                                        : null;
                                    const canProceedToPayment = Boolean(
                                        starAvailable
                                        && isCartLikeStatus
                                        && !anotherUserHoldCountdown
                                    );
                                    const shouldDimCard = !starAvailable || Boolean(anotherUserHoldCountdown);
                                    return (
                                        <article
                                            key={item.id}
                                            style={{
                                                ...recordCardStyle,
                                                position: 'relative',
                                                padding: `${px(24)}px ${px(24)}px ${px(22)}px`,
                                                border: isSelected
                                                    ? '1px solid rgba(216,168,95,0.34)'
                                                    : highlightedCartId === item.id
                                                        ? '1px solid rgba(216,168,95,0.34)'
                                                        : '1px solid rgba(255,255,255,0.08)',
                                                boxShadow: isSelected
                                                    ? '0 0 0 1px rgba(200,121,58,0.12), 0 18px 34px rgba(200,121,58,0.08)'
                                                    : highlightedCartId === item.id
                                                        ? '0 0 0 1px rgba(200,121,58,0.12), 0 18px 34px rgba(200,121,58,0.08)'
                                                        : 'none',
                                            }}
                                        >
                                            {shouldDimCard ? (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: 24,
                                                        background: 'rgba(6, 8, 12, 0.36)',
                                                        pointerEvents: 'none',
                                                        zIndex: 1,
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: isNarrow ? '1fr' : '150px minmax(0, 1fr)',
                                                    gap: 20,
                                                    alignItems: 'start',
                                                }}
                                            >
                                                <Link
                                                    to={getPublicStarPath(item.star)}
                                                    aria-label={`Open ${getStarDisplayName(item.star)} star page`}
                                                    style={{
                                                        ...previewShellStyle,
                                                        width: isNarrow ? '100%' : previewShellStyle.width,
                                                        minWidth: isNarrow ? 0 : previewShellStyle.minWidth,
                                                        justifySelf: isNarrow ? 'stretch' : 'start',
                                                        textDecoration: 'none',
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                        zIndex: 2,
                                                        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                                                    }}
                                                    onMouseEnter={(event) => {
                                                        event.currentTarget.style.transform = 'translateY(-1px)';
                                                        event.currentTarget.style.borderColor = 'rgba(216,168,95,0.28)';
                                                        event.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 30px rgba(200,121,58,0.14)';
                                                    }}
                                                    onMouseLeave={(event) => {
                                                        event.currentTarget.style.transform = 'translateY(0)';
                                                        event.currentTarget.style.borderColor = 'rgba(245,239,226,0.08)';
                                                        event.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            background: 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05), transparent 62%)',
                                                            pointerEvents: 'none',
                                                        }}
                                                    />
                                                    <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
                                                        <ambientLight intensity={0.2} />
                                                        <pointLight position={[10, 5, 10]} intensity={1.5} />
                                                        <pointLight position={[-10, -5, -10]} intensity={0.5} />
                                                        <group scale={[0.44, 0.44, 0.44]}>
                                                            <DetailedStar star={item.star} detailLevel="high" />
                                                        </group>
                                                    </Canvas>
                                                </Link>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                                                                {selectionMode ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleSelected(item.id)}
                                                                        style={{
                                                                            ...iconToggleButtonStyle,
                                                                            position: 'relative',
                                                                            zIndex: 2,
                                                                            background: isSelected ? 'rgba(216,168,95,0.14)' : 'rgba(255,255,255,0.04)',
                                                                            border: isSelected ? '1px solid rgba(216,168,95,0.34)' : iconToggleButtonStyle.border,
                                                                            color: isSelected ? '#f5efe2' : 'rgba(245,239,226,0.78)',
                                                                            boxShadow: isSelected ? '0 10px 24px rgba(200,121,58,0.16)' : 'none',
                                                                        }}
                                                                        aria-label={isSelected ? 'Selected' : 'Select star'}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                ...hollowCheckStyle,
                                                                                opacity: isSelected ? 1 : 0.55,
                                                                            }}
                                                                        />
                                                                    </button>
                                                                ) : null}
                                                                <h2
                                                                    style={{
                                                                        fontSize: '1.65rem',
                                                                        margin: 0,
                                                                        fontWeight: 700,
                                                                        color: 'var(--text-primary)',
                                                                        position: 'relative',
                                                                        zIndex: 2,
                                                                        lineHeight: 1.1,
                                                                    }}
                                                                >
                                                                    {getStarDisplayName(item.star)}
                                                                </h2>
                                                            </div>
                                                            <p
                                                                style={{
                                                                    margin: 0,
                                                                    color: 'var(--text-primary)',
                                                                    fontSize: '1rem',
                                                                    lineHeight: 1.55,
                                                                    fontWeight: 600,
                                                                    letterSpacing: '0.01em',
                                                                    opacity: item.is_star_still_available === false ? 0.8 : 0.96,
                                                                }}
                                                            >
                                                                {getHoldDisplayText(item, now)}
                                                            </p>
                                                        </div>
                                                        <div style={{ textAlign: isCompact ? 'left' : 'right', minWidth: isCompact ? 0 : 240 }}>
                                                            <strong style={{ fontSize: '1.15rem' }}>{item.owner_name || 'Pending details'}</strong>
                                                        </div>
                                                    </div>

                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: isNarrow ? 'stretch' : 'flex-end',
                                                            gap: 12,
                                                            flexWrap: 'wrap',
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="secondary-button"
                                                            style={{
                                                                width: isNarrow ? '100%' : 'fit-content',
                                                                minWidth: isNarrow ? 0 : 220,
                                                                fontSize: '0.95rem',
                                                            }}
                                                            onClick={(event) => handleRemoveSingle(event, item.id)}
                                                            disabled={isRemoving}
                                                        >
                                                            {isRemoving ? 'Updating cart...' : 'Remove this star'}
                                                        </button>
                                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: isNarrow ? 'stretch' : 'flex-end' }}>
                                                            {canProceedToPayment ? (
                                                                <Link to={resumePath} style={primaryButtonStyle}>
                                                                    <ShoppingCart size={18} />
                                                                    Proceed to payment
                                                                </Link>
                                                            ) : anotherUserActiveHold ? (
                                                                <button
                                                                    type="button"
                                                                    style={{
                                                                        ...primaryButtonStyle,
                                                                        opacity: 0.58,
                                                                        cursor: 'not-allowed',
                                                                    }}
                                                                    disabled
                                                                >
                                                                    <ShoppingCart size={18} />
                                                                    {anotherUserHoldCountdown ? `Held for ${anotherUserHoldCountdown.replace(' remaining', '')}` : 'Currently held'}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    {showBulkWarning ? (
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0,0,0,0.56)',
                                display: 'grid',
                                placeItems: 'center',
                                zIndex: 120,
                                padding: 24,
                            }}
                        >
                            <div className="glass-card" style={{ maxWidth: 720, width: '100%', padding: heroPadding }}>
                                <p className="eyebrow" style={{ marginBottom: 16 }}>Bulk checkout warning</p>
                                <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', marginBottom: 14 }}>
                                    Buying multiple stars in one go applies the same tailored information to all of them.
                                </h2>
                                <p className="muted-copy" style={{ marginBottom: 24 }}>
                                    Buy multiple stars in one go may not allow you to put the tailored information for each star. You can later edit each of them separately on the ownership page once purchased.
                                </p>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <button type="button" className="primary-button" onClick={confirmBulkProceed}>
                                        Continue to shared checkout
                                    </button>
                                    <button type="button" className="secondary-button" onClick={() => setShowBulkWarning(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default CartPage;
