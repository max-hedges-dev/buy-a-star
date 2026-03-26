import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShoppingBag, UserCircle2 } from 'lucide-react';
import fullLogoLeftWhite from '../assets/AA Full Logo Left White.png';

import { useAuth } from '../hooks/useAuth';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingUser, logout } = useAuth();

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <nav
            style={{
                height: 'var(--nav-height)',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                columnGap: '28px',
                padding: '0 40px',
                background: isScrolled ? 'rgba(6,6,6,0.78)' : 'rgba(6,6,6,0.18)',
                backdropFilter: 'blur(18px)',
                borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                transition: 'background 0.25s ease, border-color 0.25s ease',
            }}
        >
            <Link
                to="/"
                style={{
                    zIndex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '320px',
                    height: '64px',
                    overflow: 'hidden',
                }}
            >
                <img
                    alt="Aster Atlas"
                    src={fullLogoLeftWhite}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'left center',
                        transform: 'scale(0.8)',
                        transformOrigin: 'left center',
                        paddingTop: '12px'
                    }}
                />
            </Link>

            <div
                style={{
                    display: 'flex',
                    gap: '30px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                }}
            >
                <Link to="/">Home</Link>
                <Link to="/search">Explore the Galaxy</Link>
                <Link to="/buy">Register a Star</Link>
                <Link to="/about">About</Link>
                <Link to="/faq">FAQ</Link>
            </div>

            <div style={{ display: 'flex', gap: '12px', zIndex: 1, alignItems: 'center', justifySelf: 'end' }}>
                <Link
                    to="/buy"
                    aria-label="Basket"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 42,
                        height: 42,
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <ShoppingBag color="white" size={20} />
                </Link>

                {!isLoadingUser && isAuthenticated ? (
                    <>
                        <Link
                            to="/account"
                            aria-label="My account"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 42,
                                height: 42,
                                borderRadius: 999,
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <UserCircle2 size={22} />
                        </Link>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 14px',
                                borderRadius: 999,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'white',
                            }}
                            type="button"
                        >
                            <LogOut size={16} />
                            Log out
                        </button>
                    </>
                ) : null}

                {!isLoadingUser && !isAuthenticated ? (
                    <Link
                        to="/auth"
                        style={{
                            padding: '10px 16px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        Sign In
                    </Link>
                ) : null}
            </div>
        </nav>
    );
};

export default Navbar;
