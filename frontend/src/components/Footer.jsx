import React from 'react';
import { Link } from 'react-router-dom';
import fullLogoLeftWhite from '../assets/AA Full Logo Left White.png';

const headingStyle = {
    color: '#ff9150',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: '0.78rem',
    marginBottom: '14px',
};

const Footer = () => {
    return (
        <footer
            style={{
                position: 'relative',
                background: `
                    radial-gradient(circle at 50% 0%, rgba(255,96,24,0.12), transparent 30%),
                    linear-gradient(180deg, #090909 0%, #030303 100%)
                `,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '54px 40px 42px',
                zIndex: 2,
            }}
        >
            <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 0.8fr 0.8fr',
                        gap: '40px',
                        marginBottom: '36px',
                    }}
                >
                    <div>
                        <div style={{ width: '420px', maxWidth: '100%', height: '84px', overflow: 'hidden', marginBottom: '16px' }}>
                            <img
                                alt="Aster Atlas"
                                src={fullLogoLeftWhite}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: 'left',
                                    transform: 'scale(0.7)',
                                    transformOrigin: 'left',
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <div style={headingStyle}>Explore</div>
                        <div style={{ display: 'grid', gap: '12px', color: '#d8d8dd' }}>
                            <Link to="/">Home</Link>
                            <Link to="/buy">Buy a Star</Link>
                            <Link to="/search">Search Galaxy</Link>
                            <Link to="/about">About</Link>
                            <Link to="/faq">FAQ</Link>
                        </div>
                    </div>

                    <div>
                        <div style={headingStyle}>Legal</div>
                        <div style={{ display: 'grid', gap: '12px', color: '#d8d8dd' }}>
                            <Link to="/privacy">Privacy Notice</Link>
                            <Link to="/terms">Terms &amp; Conditions</Link>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        paddingTop: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '18px',
                        flexWrap: 'wrap',
                        color: '#818187',
                        fontSize: '0.92rem',
                    }}
                >
                    <span>© 2026 Aster Atlas. All rights reserved.</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
