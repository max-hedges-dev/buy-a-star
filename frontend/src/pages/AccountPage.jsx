import React from 'react';

import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';

const wrapperStyle = {
    minHeight: '100vh',
    background:
        'radial-gradient(circle at top right, rgba(255,77,0,0.16), transparent 28%), radial-gradient(circle at left center, rgba(0,188,212,0.14), transparent 24%), linear-gradient(180deg, #040404 0%, #020202 100%)',
};

const AccountPage = () => {
    const { user } = useAuth();
    const displayName = user?.full_name || user?.email || 'there';

    return (
        <div style={wrapperStyle}>
            <Navbar />
            <main style={{ padding: '132px 24px 48px' }}>
                <div style={{ maxWidth: 860, margin: '0 auto' }}>
                    <section className="glass-card" style={{ padding: '42px 40px' }}>
                        <p className="eyebrow">My account</p>
                        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                            Hey {displayName}
                        </h1>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AccountPage;
