import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import { fetchResaleCheckoutSessionStatus } from '../services/api';
import { formatMoney } from '../utils/ownership';

const pageStyle = {
    minHeight: '100vh',
    background: `
        radial-gradient(circle at top center, rgba(255,101,24,0.18), transparent 26%),
        radial-gradient(circle at 20% 18%, rgba(255,255,255,0.06), transparent 22%),
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
    background: 'linear-gradient(135deg, #ff5b16 0%, #ff8b2d 100%)',
    color: 'white',
    fontWeight: 700,
    letterSpacing: '0.04em',
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 18px 40px rgba(255,91,22,0.22)',
};

const ResaleCheckoutCompletePage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState('loading');
    const [checkoutData, setCheckoutData] = useState(null);
    const [error, setError] = useState('');
    const { isNarrow, px } = useResponsiveScale({ compactWidth: 960 });

    useEffect(() => {
        const loadStatus = async () => {
            if (!sessionId) {
                setStatus('error');
                setError('Missing Stripe resale checkout session.');
                return;
            }

            try {
                const response = await fetchResaleCheckoutSessionStatus(sessionId);
                setCheckoutData(response);
                setStatus(response.fulfilled ? 'success' : 'pending');
            } catch (requestError) {
                setStatus('error');
                setError(requestError.message);
            }
        };

        loadStatus();
    }, [sessionId]);

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `calc(var(--nav-height) + ${px(48)}px) ${px(isNarrow ? 18 : 24)}px ${px(110)}px` }}>
                <div style={{ maxWidth: 1040, margin: '0 auto' }}>
                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: `${px(42)}px ${px(40)}px`, textAlign: 'center' }}>
                            <p className="eyebrow" style={{ marginBottom: 18 }}>Resale Transfer</p>
                            <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', marginBottom: 16 }}>
                                Confirming the transfer
                            </h1>
                            <p className="muted-copy">We are waiting for Stripe to confirm the resale payment.</p>
                        </section>
                    ) : null}

                    {status === 'success' && checkoutData ? (
                        <section className="glass-card" style={{ padding: `${px(42)}px ${px(40)}px` }}>
                            <p className="eyebrow" style={{ marginBottom: 18 }}>Resale Complete</p>
                            <h1 style={{ fontSize: 'clamp(2.6rem, 5.4vw, 4.8rem)', lineHeight: 0.94, marginBottom: 16 }}>
                                {checkoutData.star_name} is now in your account
                            </h1>
                            <p className="muted-copy" style={{ maxWidth: 720, marginBottom: 28 }}>
                                Stripe confirmed the resale payment, the listing has closed, and Aster Atlas has transferred the ownership record to you.
                            </p>
                            <div className="status-grid" style={{ marginBottom: 26 }}>
                                <div className="status-tile">
                                    <div>
                                        <strong>Resale price</strong>
                                        <p>{formatMoney(checkoutData.amount, checkoutData.currency)}</p>
                                    </div>
                                </div>
                                <div className="status-tile">
                                    <div>
                                        <strong>Sale status</strong>
                                        <p>{checkoutData.sale_status.replaceAll('_', ' ')}</p>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                <Link to="/account?section=stars" style={primaryButtonStyle}>
                                    Open My Stars
                                </Link>
                                <Link to="/account?section=orders" className="secondary-button" style={{ width: isNarrow ? '100%' : 'fit-content', minWidth: 220 }}>
                                    View Records
                                </Link>
                            </div>
                        </section>
                    ) : null}

                    {status === 'pending' && checkoutData ? (
                        <section className="glass-card" style={{ padding: `${px(42)}px ${px(40)}px`, textAlign: 'center' }}>
                            <p className="eyebrow" style={{ marginBottom: 18 }}>Resale Pending</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: 16 }}>Payment is not complete yet</h1>
                            <p className="muted-copy" style={{ maxWidth: 680, margin: '0 auto 26px' }}>
                                Stripe returned {checkoutData.stripe_status}. Ownership will transfer only after payment succeeds.
                            </p>
                            <Link to="/buy" className="secondary-button" style={{ width: 'auto', minWidth: 220, margin: '0 auto' }}>
                                Back to Registry
                            </Link>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: `${px(42)}px ${px(40)}px`, textAlign: 'center' }}>
                            <p className="eyebrow" style={{ marginBottom: 18 }}>Resale Error</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: 16 }}>We could not confirm that resale</h1>
                            <p className="muted-copy" style={{ maxWidth: 680, margin: '0 auto 26px' }}>{error}</p>
                            <Link to="/buy" className="secondary-button" style={{ width: 'auto', minWidth: 220, margin: '0 auto' }}>
                                Back to Registry
                            </Link>
                        </section>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default ResaleCheckoutCompletePage;
