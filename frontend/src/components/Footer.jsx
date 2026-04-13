import React from 'react';
import { Link } from 'react-router-dom';
import fullLogoLeftWhite from '../assets/AA Full Logo Left White.png';

const headingStyle = {
    color: '#ff9150',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: 'clamp(0.72rem, 1.4vw, 0.78rem)',
    marginBottom: '14px',
};

const Footer = () => {
    return (
        <footer
            className="site-footer"
            style={{
                position: 'relative',
                background: `
                    radial-gradient(circle at 50% 0%, rgba(255,96,24,0.12), transparent 30%),
                    linear-gradient(180deg, #090909 0%, #030303 100%)
                `,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: 'clamp(38px, 5vw, 54px) clamp(16px, 4vw, 40px) clamp(32px, 4vw, 42px)',
                zIndex: 2,
            }}
        >
            <style>
                {`
                    .site-footer__inner {
                        max-width: 1240px;
                        margin: 0 auto;
                    }

                    .site-footer__grid {
                        display: grid;
                        grid-template-columns: minmax(260px, 1.2fr) repeat(2, minmax(150px, 0.8fr));
                        gap: clamp(24px, 4vw, 40px);
                        margin-bottom: clamp(28px, 4vw, 36px);
                        align-items: start;
                    }

                    .site-footer__logo-frame {
                        width: clamp(210px, 30vw, 420px);
                        height: clamp(52px, 7vw, 84px);
                        overflow: hidden;
                        margin-bottom: 16px;
                    }

                    .site-footer__logo {
                        display: block;
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        object-position: left;
                        transform: scale(0.7);
                        transform-origin: left;
                    }

                    .site-footer__links {
                        display: grid;
                        gap: clamp(10px, 1.4vw, 12px);
                        color: #d8d8dd;
                        font-size: clamp(0.92rem, 1.6vw, 1rem);
                    }

                    .site-footer__links a {
                        color: inherit;
                        text-decoration: none;
                        transition: color 0.2s ease, transform 0.2s ease;
                    }

                    .site-footer__links a:hover {
                        color: #ffffff;
                        transform: translateX(2px);
                    }

                    .site-footer__bottom {
                        border-top: 1px solid rgba(255,255,255,0.08);
                        padding-top: 20px;
                        display: flex;
                        justify-content: space-between;
                        gap: 18px;
                        flex-wrap: wrap;
                        color: #818187;
                        font-size: clamp(0.82rem, 1.4vw, 0.92rem);
                    }

                    @media (max-width: 760px) {
                        .site-footer__grid {
                            grid-template-columns: 1fr 1fr;
                        }

                        .site-footer__brand {
                            grid-column: 1 / -1;
                        }
                    }

                    @media (max-width: 520px) {
                        .site-footer__grid {
                            grid-template-columns: 1fr;
                            gap: 26px;
                        }

                        .site-footer__logo-frame {
                            width: min(260px, 82vw);
                            height: 58px;
                        }

                        .site-footer__bottom {
                            justify-content: flex-start;
                        }
                    }
                `}
            </style>

            <div className="site-footer__inner">
                <div className="site-footer__grid">
                    <div className="site-footer__brand">
                        <div className="site-footer__logo-frame">
                            <img
                                alt="Aster Atlas"
                                src={fullLogoLeftWhite}
                                className="site-footer__logo"
                            />
                        </div>
                    </div>

                    <div>
                        <div style={headingStyle}>Explore</div>
                        <div className="site-footer__links">
                            <Link to="/">Home</Link>
                            <Link to="/buy">Buy a Star</Link>
                            <Link to="/search">Search Galaxy</Link>
                            <Link to="/about">About</Link>
                            <Link to="/faq">FAQ</Link>
                        </div>
                    </div>

                    <div>
                        <div style={headingStyle}>Legal</div>
                        <div className="site-footer__links">
                            <Link to="/privacy">Privacy Notice</Link>
                            <Link to="/terms">Terms &amp; Conditions</Link>
                        </div>
                    </div>
                </div>

                <div className="site-footer__bottom">
                    <span>&copy; 2026 Aster Atlas. All rights reserved.</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
