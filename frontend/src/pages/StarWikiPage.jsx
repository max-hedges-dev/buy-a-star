import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchPublicRegistration } from '../services/api';
import { getStarSlug } from '../utils/ownership';

const StarWikiPage = () => {
    const { slug } = useParams();
    const [registration, setRegistration] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');

    useEffect(() => {
        const loadRegistration = async () => {
            try {
                const response = await fetchPublicRegistration(slug);
                setRegistration(response);
                setStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setStatus('error');
            }
        };

        loadRegistration();
    }, [slug]);

    const star = registration?.star;
    const starSlug = star ? getStarSlug(star) : null;

    if (status === 'ready' && registration && starSlug) {
        return <Navigate to={`/search/${starSlug}`} replace />;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--page-background)' }}>
            <Navbar />
            <main style={{ padding: '124px 24px 80px' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 24 }}>
                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '36px 34px' }}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>Star page</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>Opening this registered star</h1>
                            <p className="muted-copy">Taking you to the main star page in Aster Atlas.</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '36px 34px' }}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>Star page</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>We couldn't open this star record</h1>
                            <p className="muted-copy" style={{ marginBottom: 20 }}>{error}</p>
                            <Link to="/search" className="secondary-button" style={{ width: 'fit-content' }}>
                                Explore the Atlas
                            </Link>
                        </section>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default StarWikiPage;
