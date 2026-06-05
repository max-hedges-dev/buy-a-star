import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShoppingCart, UserCircle2, X } from 'lucide-react';
import fullLogoLeftWhite from '../assets/AA Full Logo Left White.png';
import symbolWhite from '../assets/AA Symbol White.png';

import { useAuth } from '../hooks/useAuth';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/search', label: 'Explore the Atlas' },
    { to: '/buy', label: 'Find a Star' },
    { to: '/claim', label: 'Claim a Star' },
    { to: '/about', label: 'About' },
    { to: '/faq', label: 'FAQ' },
];

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
    }));
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingUser, logout } = useAuth();
    const cartTarget = isAuthenticated ? '/account/cart' : '/auth?next=%2Faccount%2Fcart';
    const accountTarget = isAuthenticated ? '/account' : '/auth';

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const onResize = () => setViewportSize({
            width: window.innerWidth,
            height: window.innerHeight,
        });
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleLogout = async () => {
        setIsMenuOpen(false);
        await logout();
        navigate('/');
    };

    const { width: viewportWidth, height: viewportHeight } = viewportSize;
    const navScale = clamp(Math.min(viewportWidth / 1440, viewportHeight / 920), 0.66, 1.04);
    const useSymbolLogo = viewportWidth < 720;
    const showCenterLinks = viewportWidth >= 980;
    const navHeight = Math.round(clamp(80 * navScale, 58, 82));
    const navPaddingX = Math.round(clamp(40 * navScale, 14, 40));
    const resolvedNavPaddingX = useSymbolLogo ? 2 : navPaddingX;
    const logoWidth = useSymbolLogo ? Math.round(clamp(52 * navScale, 36, 54)) : Math.round(clamp(320 * navScale, 170, 320));
    const logoHeight = useSymbolLogo ? Math.round(clamp(52 * navScale, 36, 54)) : Math.round(clamp(64 * navScale, 42, 64));
    const compactLogoSize = Math.round(clamp(125 * navScale, 86, 130));
    const actionSize = Math.round(clamp(42 * navScale, 34, 42));
    const actionIconSize = Math.round(clamp(22 * navScale, 18, 22));
    const authGap = Math.round(clamp(12 * navScale, 8, 12));
    const actionFontSize = `${clamp(0.88 * navScale, 0.72, 0.88).toFixed(3)}rem`;
    const resolvedLogoWidth = useSymbolLogo ? compactLogoSize : logoWidth;
    const resolvedLogoHeight = useSymbolLogo ? compactLogoSize : logoHeight;
    const navActionButtonStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: actionSize,
        height: actionSize,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(245,239,226,0.08)',
        color: 'var(--text-color)',
        cursor: 'pointer',
        pointerEvents: 'auto',
    };
    const navLinkStyle = {
        color: 'var(--text-color)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        textDecoration: 'none',
    };

    useEffect(() => {
        if (showCenterLinks && isMenuOpen) {
            setIsMenuOpen(false);
        }
    }, [isMenuOpen, showCenterLinks]);

    return (
        <>
            <nav
                style={{
                    height: `${navHeight}px`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: `0 ${resolvedNavPaddingX}px`,
                    background: isScrolled ? 'rgba(7,10,17,0.84)' : 'rgba(7,10,17,0.28)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: isScrolled ? '1px solid rgba(245,239,226,0.08)' : '1px solid transparent',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    width: '100%',
                    zIndex: 50,
                    pointerEvents: 'auto',
                    transition: 'background 0.25s ease, border-color 0.25s ease',
                }}
            >
                <Link
                    to="/"
                    style={{
                        zIndex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: useSymbolLogo ? 'flex-start' : 'center',
                        width: `${resolvedLogoWidth}px`,
                        height: `${resolvedLogoHeight}px`,
                        overflow: useSymbolLogo ? 'visible' : 'hidden',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                    }}
                >
                    <img
                        alt="Aster Atlas"
                        src={useSymbolLogo ? symbolWhite : fullLogoLeftWhite}
                        style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            objectFit: useSymbolLogo ? 'contain' : 'cover',
                            objectPosition: 'left center',
                            transform: useSymbolLogo ? 'none' : 'scale(0.8)',
                            transformOrigin: 'left center',
                            paddingTop: useSymbolLogo ? 0 : `${Math.round(clamp(12 * navScale, 7, 12))}px`
                        }}
                    />
                </Link>

                <div
                    style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: showCenterLinks ? 'flex' : 'none',
                        gap: `${Math.round(clamp(30 * navScale, 16, 30))}px`,
                        alignItems: 'center',
                        fontSize: `${clamp(0.9 * navScale, 0.74, 0.9).toFixed(3)}rem`,
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        zIndex: 1,
                    }}
                >
                    {navLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            style={navLinkStyle}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {!showCenterLinks ? (
                    <button
                        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        onClick={() => setIsMenuOpen((open) => !open)}
                        style={{
                            ...navActionButtonStyle,
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 2,
                        }}
                        type="button"
                    >
                        {isMenuOpen ? <X size={actionIconSize} /> : <Menu size={actionIconSize} />}
                    </button>
                ) : null}

                <div style={{ display: 'flex', gap: `${authGap}px`, zIndex: 1, alignItems: 'center', marginLeft: 'auto' }}>
                    <div className="nav-action-tooltip">
                        <Link
                            to={cartTarget}
                            aria-label="My cart"
                            style={navActionButtonStyle}
                        >
                            <ShoppingCart size={actionIconSize} />
                        </Link>
                        <span className="nav-action-tooltip__label">Cart</span>
                    </div>

                    {!isLoadingUser && isAuthenticated ? (
                        <>
                            <div className="nav-action-tooltip">
                                <Link
                                    to={accountTarget}
                                    aria-label="My account"
                                    style={navActionButtonStyle}
                                >
                                    <UserCircle2 size={actionIconSize} />
                                </Link>
                                <span className="nav-action-tooltip__label">Account</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: Math.round(clamp(8 * navScale, 6, 8)),
                                    padding: `${Math.round(clamp(10 * navScale, 8, 10))}px ${Math.round(clamp(14 * navScale, 10, 14))}px`,
                                    borderRadius: 999,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(245,239,226,0.08)',
                                    color: 'var(--text-color)',
                                    fontSize: actionFontSize,
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                }}
                                type="button"
                            >
                                <LogOut size={Math.round(clamp(16 * navScale, 13, 16))} />
                                Log out
                            </button>
                        </>
                    ) : null}

                    {!isLoadingUser && !isAuthenticated ? (
                        <>
                            <div className="nav-action-tooltip">
                                <Link
                                    to={accountTarget}
                                    aria-label="Sign in or open account"
                                    style={navActionButtonStyle}
                                >
                                    <UserCircle2 size={actionIconSize} />
                                </Link>
                                <span className="nav-action-tooltip__label">Account</span>
                            </div>
                            <Link
                                to="/auth"
                                style={{
                                    padding: `${Math.round(clamp(10 * navScale, 8, 10))}px ${Math.round(clamp(16 * navScale, 10, 16))}px`,
                                    borderRadius: 999,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(245,239,226,0.08)',
                                    color: 'var(--text-color)',
                                    fontSize: actionFontSize,
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                }}
                            >
                                Sign in
                            </Link>
                        </>
                    ) : null}
                </div>
            </nav>

            {!showCenterLinks ? (
                <>
                    <div
                        onClick={() => setIsMenuOpen(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 55,
                            background: 'rgba(0,0,0,0.42)',
                            opacity: isMenuOpen ? 1 : 0,
                            pointerEvents: isMenuOpen ? 'auto' : 'none',
                            transition: 'opacity 0.22s ease',
                        }}
                    />
                    <aside
                        aria-hidden={!isMenuOpen}
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: 'min(82vw, 360px)',
                            zIndex: 60,
                            padding: `${navHeight + 26}px 24px 28px`,
                            background: 'linear-gradient(160deg, rgba(16,18,23,0.98), rgba(28,21,18,0.96))',
                            borderLeft: '1px solid rgba(245,239,226,0.1)',
                            boxShadow: '-28px 0 80px rgba(0,0,0,0.48)',
                            transform: isMenuOpen ? 'translateX(0)' : 'translateX(104%)',
                            transition: 'transform 0.26s ease',
                            display: 'grid',
                            alignContent: 'start',
                            gap: 14,
                        }}
                    >
                        <p
                            style={{
                                color: 'var(--primary-strong)',
                                fontSize: '0.76rem',
                                letterSpacing: '0.22em',
                                textTransform: 'uppercase',
                                fontWeight: 800,
                                marginBottom: 8,
                            }}
                        >
                            Where to?
                        </p>
                        {navLinks.map((link) => (
                            <Link
                                key={link.to}
                                onClick={() => {
                                    setIsMenuOpen(false);
                                }}
                                to={link.to}
                                style={{
                                    padding: '16px 18px',
                                    borderRadius: 18,
                                    background: 'rgba(255,255,255,0.045)',
                                    border: '1px solid rgba(245,239,226,0.08)',
                                    color: 'var(--text-color)',
                                    fontSize: '0.94rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </aside>
                </>
            ) : null}
        </>
    );
};

export default Navbar;
