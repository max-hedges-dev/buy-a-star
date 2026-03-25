import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <nav
            style={{
                height: 'var(--nav-height)',
                display: 'flex',
                alignItems: 'center',
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
            <Link to="/" style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', zIndex: 1 }}>
                Aster Atlas
            </Link>

            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '30px',
                    alignItems: 'center',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                }}
            >
                <Link to="/">Home</Link>
                <Link to="/buy">Register a Star</Link>
                <Link to="/search">Explore the Galaxy</Link>
                <Link to="/about">About</Link>
                <Link to="/faq">FAQ</Link>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginLeft: 'auto', zIndex: 1 }}>
                <Link to="/search">
                    <Search color="white" size={24} />
                </Link>
                <Link to="/buy">
                    <ShoppingBag color="white" size={24} />
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
