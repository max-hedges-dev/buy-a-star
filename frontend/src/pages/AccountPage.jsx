import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { fetchAccountOverview } from '../services/api';

const wrapperStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top right, rgba(255,77,0,0.16), transparent 28%), radial-gradient(circle at left center, rgba(0,188,212,0.14), transparent 24%), linear-gradient(180deg, #040404 0%, #020202 100%)',
};

const formatMoney = (amount, currency) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: (currency || 'gbp').toUpperCase(),
    }).format(amount);

const formatDate = (value) => {
    if (!value) {
        return 'Pending';
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
};

const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const AccountPage = () => {
    const { user } = useAuth();
    const displayName = user?.full_name || user?.email || 'there';
    const [overview, setOverview] = useState({ orders: [], stars: [] });
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');

    useEffect(() => {
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

        loadOverview();
    }, []);

    const summary = useMemo(() => ({
        orders: overview.orders.length,
        stars: overview.stars.length,
        certificates: overview.orders.filter((order) => order.includes_certificate && order.status === 'fulfilled').length,
    }), [overview]);

    return (
        <div style={wrapperStyle}>
            <Navbar />
            <main style={{ padding: '132px 24px 64px' }}>
                <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 24 }}>
                    <section className="glass-card" style={{ padding: '42px 40px' }}>
                        <p className="eyebrow" style={{ marginBottom: 16 }}>My account</p>
                        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginBottom: 14 }}>
                            Hey {displayName}
                        </h1>
                        <p className="muted-copy" style={{ maxWidth: 760, marginBottom: 28 }}>
                            Your orders, registered stars, and certificate previews all live here. This is the first pass of the account area, so we&apos;re keeping it focused on the essentials.
                        </p>

                        <div className="status-grid" style={{ marginBottom: 22 }}>
                            <div className="status-tile">
                                <div>
                                    <strong>Total orders</strong>
                                    <p>{summary.orders}</p>
                                </div>
                            </div>
                            <div className="status-tile">
                                <div>
                                    <strong>Registered stars</strong>
                                    <p>{summary.stars}</p>
                                </div>
                            </div>
                            <div className="status-tile">
                                <div>
                                    <strong>Certificates issued</strong>
                                    <p>{summary.certificates}</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="secondary-button"
                                style={{ width: 'fit-content', minWidth: 200 }}
                                onClick={() => scrollToSection('account-orders')}
                            >
                                View orders
                            </button>
                            <button
                                type="button"
                                className="secondary-button"
                                style={{ width: 'fit-content', minWidth: 200 }}
                                onClick={() => scrollToSection('account-stars')}
                            >
                                View stars
                            </button>
                        </div>
                    </section>

                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '30px 32px' }}>
                            <p className="muted-copy">Loading your account details...</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '30px 32px' }}>
                            <div className="status-banner status-banner-error">
                                {error || 'We could not load your account details right now.'}
                            </div>
                        </section>
                    ) : null}

                    {status === 'ready' ? (
                        <>
                            <section id="account-orders" className="glass-card" style={{ padding: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
                                    <div>
                                        <p className="eyebrow" style={{ marginBottom: 14 }}>Orders</p>
                                        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>Your purchases</h2>
                                    </div>
                                    <p className="muted-copy">Each order is tied to your account and can be revisited here.</p>
                                </div>

                                {overview.orders.length === 0 ? (
                                    <div className="status-banner">
                                        You haven&apos;t placed an order yet.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 18 }}>
                                        {overview.orders.map((order) => (
                                            <article
                                                key={order.id}
                                                style={{
                                                    padding: '22px 24px',
                                                    borderRadius: 24,
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    display: 'grid',
                                                    gap: 16,
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                                    <div>
                                                        <div className="eyebrow" style={{ marginBottom: 10 }}>Order #{order.id}</div>
                                                        <h3 style={{ fontSize: '1.5rem', marginBottom: 6 }}>{order.star.display_name}</h3>
                                                        <p className="muted-copy">
                                                            Registered to {order.owner_name} • {formatMoney(order.amount, order.currency)}
                                                        </p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{order.registration_number || 'Pending registration number'}</div>
                                                        <p className="muted-copy">{formatDate(order.fulfilled_at || order.created_at)}</p>
                                                    </div>
                                                </div>

                                                <div className="status-grid">
                                                    <div className="status-tile">
                                                        <div>
                                                            <strong>Status</strong>
                                                            <p>{order.status.replaceAll('_', ' ')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="status-tile">
                                                        <div>
                                                            <strong>Certificate</strong>
                                                            <p>{order.includes_certificate ? 'Included' : 'Not included'}</p>
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
                                                </div>

                                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                                    <Link
                                                        to={`/account/orders/${order.id}`}
                                                        className="secondary-button"
                                                        style={{ width: 'fit-content', minWidth: 220 }}
                                                    >
                                                        {order.includes_certificate ? 'View certificate' : 'View order'}
                                                    </Link>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section id="account-stars" className="glass-card" style={{ padding: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
                                    <div>
                                        <p className="eyebrow" style={{ marginBottom: 14 }}>Stars</p>
                                        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>Currently held in your account</h2>
                                    </div>
                                    <p className="muted-copy">A quick placeholder view of the stars you&apos;ve already registered.</p>
                                </div>

                                {overview.stars.length === 0 ? (
                                    <div className="status-banner">
                                        Once you complete a purchase, your registered stars will appear here.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 18 }}>
                                        {overview.stars.map((star) => (
                                            <article
                                                key={`${star.id}-${star.registration_number}`}
                                                style={{
                                                    padding: '22px 24px',
                                                    borderRadius: 24,
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    display: 'grid',
                                                    gap: 14,
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '1.45rem', marginBottom: 8 }}>{star.display_name}</h3>
                                                        <p className="muted-copy">Held in the name of {star.owner_name}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{star.registration_number}</div>
                                                        <p className="muted-copy">{formatDate(star.purchase_date)}</p>
                                                    </div>
                                                </div>

                                                <div className="status-grid">
                                                    <div className="status-tile">
                                                        <div>
                                                            <strong>Scientific name</strong>
                                                            <p>{star.scientific_name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="status-tile">
                                                        <div>
                                                            <strong>Category</strong>
                                                            <p>{star.category}</p>
                                                        </div>
                                                    </div>
                                                    <div className="status-tile">
                                                        <div>
                                                            <strong>Constellation</strong>
                                                            <p>{star.constellation || 'Not listed'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="status-tile">
                                                        <div>
                                                            <strong>Spectral type</strong>
                                                            <p>{star.spectral_type || 'Not listed'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default AccountPage;
