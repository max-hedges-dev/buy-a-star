import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import CertificatePreview from '../components/CertificatePreview';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchAccountOrder } from '../services/api';

const pageStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top right, rgba(255,77,0,0.14), transparent 24%), radial-gradient(circle at left center, rgba(0,188,212,0.1), transparent 22%), linear-gradient(180deg, #040404 0%, #020202 100%)',
};

const formatMoney = (amount, currency) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: (currency || 'gbp').toUpperCase(),
    }).format(amount);

const OrderCertificatePage = () => {
    const { transactionId } = useParams();
    const [order, setOrder] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const response = await fetchAccountOrder(transactionId);
                setOrder(response);
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadOrder();
    }, [transactionId]);

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: '124px 24px 72px' }}>
                <div style={{ maxWidth: 1220, margin: '0 auto', display: 'grid', gap: 28 }}>
                    <section className="glass-card" style={{ padding: '34px 36px' }}>
                        <div style={{ width: 74, height: 1, marginBottom: 24, background: 'rgba(255,255,255,0.78)' }} />
                        <p className="eyebrow" style={{ marginBottom: 16 }}>Certificate</p>

                        {status === 'loading' ? (
                            <>
                                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 14 }}>
                                    Preparing your certificate
                                </h1>
                                <p className="muted-copy">Loading the registered star details for this order.</p>
                            </>
                        ) : null}

                        {status === 'error' ? (
                            <>
                                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 14 }}>
                                    We couldn&apos;t load that certificate
                                </h1>
                                <p className="muted-copy" style={{ marginBottom: 24 }}>{error}</p>
                                <Link to="/account" className="secondary-button" style={{ width: 'fit-content', minWidth: 220 }}>
                                    Back to My Account
                                </Link>
                            </>
                        ) : null}

                        {status === 'ready' && order ? (
                            <>
                                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 14 }}>
                                    Certificate for {order.star.display_name}
                                </h1>
                                <p className="muted-copy" style={{ maxWidth: 780, marginBottom: 28 }}>
                                    Registration {order.registration_number} is tied to {order.owner_name}. This is the current live certificate preview for the order saved against your account.
                                </p>

                                <CertificatePreview order={order} />

                                <div className="status-grid" style={{ marginTop: 28 }}>
                                    <div className="status-tile">
                                        <div>
                                            <strong>Order value</strong>
                                            <p>{formatMoney(order.amount, order.currency)}</p>
                                        </div>
                                    </div>
                                    <div className="status-tile">
                                        <div>
                                            <strong>Constellation</strong>
                                            <p>{order.star.constellation || 'Not listed'}</p>
                                        </div>
                                    </div>
                                    <div className="status-tile">
                                        <div>
                                            <strong>Distance</strong>
                                            <p>{order.star.distance_ly.toFixed(2)} light years</p>
                                        </div>
                                    </div>
                                    <div className="status-tile">
                                        <div>
                                            <strong>Category</strong>
                                            <p>{order.star.category}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default OrderCertificatePage;
