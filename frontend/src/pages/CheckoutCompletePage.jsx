import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchCheckoutSessionStatus } from '../services/api';

const CheckoutCompletePage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState('loading');
    const [checkoutData, setCheckoutData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadStatus = async () => {
            if (!sessionId) {
                setStatus('error');
                setError('Missing Stripe checkout session.');
                return;
            }

            try {
                const response = await fetchCheckoutSessionStatus(sessionId);
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
        <>
            <Navbar />
            <section
                style={{
                    padding: 'calc(var(--nav-height) + 56px) 40px 120px',
                    minHeight: '100vh',
                    background: `
                        radial-gradient(circle at 50% 0%, rgba(255,101,24,0.12), transparent 28%),
                        linear-gradient(180deg, #050505 0%, #090909 100%)
                    `,
                }}
            >
                <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                    <div className="glass-card" style={{ padding: '42px 40px' }}>
                        <div style={{ width: '72px', height: '1px', margin: '0 auto 32px', background: 'rgba(255,255,255,0.78)' }} />

                        {status === 'loading' ? (
                            <div style={{ textAlign: 'center' }}>
                                <div className="eyebrow" style={{ marginBottom: '18px' }}>Stripe Checkout</div>
                                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: '16px' }}>Confirming your purchase</h1>
                                <p className="muted-copy">We’re checking Stripe and finalising your star registration now.</p>
                            </div>
                        ) : null}

                        {status === 'success' && checkoutData ? (
                            <div style={{ textAlign: 'center' }}>
                                <div className="eyebrow" style={{ marginBottom: '18px' }}>Purchase Complete</div>
                                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: '16px' }}>
                                    {checkoutData.star_name} is now registered
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: '680px', margin: '0 auto 26px' }}>
                                    The payment completed successfully and the registry entry has been issued to {checkoutData.owner_name}.
                                </p>
                                <div className="status-grid" style={{ marginBottom: '28px' }}>
                                    <div className="status-tile">
                                        <div>
                                            <strong>Registry owner</strong>
                                            <p>{checkoutData.owner_name}</p>
                                        </div>
                                    </div>
                                    <div className="status-tile">
                                        <div>
                                            <strong>Certificate</strong>
                                            <p>{checkoutData.includes_certificate ? 'Included in this order' : 'Not included in this order'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                    <Link to="/search" className="secondary-button" style={{ width: 'auto', minWidth: '220px' }}>
                                        Explore the Galaxy
                                    </Link>
                                    <Link to="/account" className="secondary-button" style={{ width: 'auto', minWidth: '220px' }}>
                                        Go to My Account
                                    </Link>
                                </div>
                            </div>
                        ) : null}

                        {status === 'pending' && checkoutData ? (
                            <div style={{ textAlign: 'center' }}>
                                <div className="eyebrow" style={{ marginBottom: '18px' }}>Checkout Not Finished</div>
                                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: '16px' }}>Your payment is not complete yet</h1>
                                <p className="muted-copy" style={{ maxWidth: '680px', margin: '0 auto 26px' }}>
                                    Stripe returned a status of {checkoutData.status}. You can head back to the star and try again.
                                </p>
                                <Link to="/buy" className="secondary-button" style={{ width: 'auto', minWidth: '220px', margin: '0 auto' }}>
                                    Back to the registry
                                </Link>
                            </div>
                        ) : null}

                        {status === 'error' ? (
                            <div style={{ textAlign: 'center' }}>
                                <div className="eyebrow" style={{ marginBottom: '18px' }}>Checkout Error</div>
                                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', marginBottom: '16px' }}>We couldn’t confirm that purchase</h1>
                                <p className="muted-copy" style={{ maxWidth: '680px', margin: '0 auto 26px' }}>{error}</p>
                                <Link to="/buy" className="secondary-button" style={{ width: 'auto', minWidth: '220px', margin: '0 auto' }}>
                                    Back to the registry
                                </Link>
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
};

export default CheckoutCompletePage;
