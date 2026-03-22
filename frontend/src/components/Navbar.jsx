import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';

const Navbar = () => {
    return (
        <nav style={{
            height: 'var(--nav-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 40px',
            background: 'transparent',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10
        }}>
            <Link to="/" style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Buy A Star
            </Link>

            <div style={{ display: 'flex', gap: '30px', alignItems: 'center', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Link to="/">Home</Link>
                <Link to="/buy">Buy a Star</Link>
                <Link to="/search">Search Galaxy</Link>
                <Link to="/about">About</Link>
                <Link to="/faq">FAQ</Link>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <Link to="/search">
                    <Search color="white" size={24} />
                </Link>
                <Link to="/cart">
                    <ShoppingBag color="white" size={24} />
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
