import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { fetchPublicRegistration } from '../services/api';
import { getStarDisplayName, getStarSlug } from '../utils/ownership';

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

    return (
        <div style={{ minHeight: '100vh', background: 'var(--page-background)' }}>
            <Navbar />
            <main style={{ padding: '124px 24px 80px' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 24 }}>
                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: '36px 34px' }}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>StarWiki record</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>Loading this star record</h1>
                            <p className="muted-copy">Preparing the public star page in Aster Atlas.</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: '36px 34px' }}>
                            <p className="eyebrow" style={{ marginBottom: 14 }}>StarWiki record</p>
                            <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)', marginBottom: 12 }}>We couldn't open this star record</h1>
                            <p className="muted-copy" style={{ marginBottom: 20 }}>{error}</p>
                            <Link to="/search" className="secondary-button" style={{ width: 'fit-content' }}>
                                Explore the Atlas
                            </Link>
                        </section>
                    ) : null}

                    {status === 'ready' && registration && star ? (
                        <>
                            <section className="glass-card" style={{ padding: '42px 38px' }}>
                                <div style={{ display: 'grid', gap: 20 }}>
                                    <div>
                                        <p className="eyebrow" style={{ marginBottom: 14 }}>StarWiki record powered by Aster Atlas</p>
                                        {registration.is_demo ? (
                                            <p className="eyebrow" style={{ marginBottom: 10, color: 'var(--primary-strong)' }}>Demo record</p>
                                        ) : null}
                                        <h1 style={{ fontSize: 'clamp(2.6rem, 5vw, 4.6rem)', lineHeight: 0.94, marginBottom: 16 }}>
                                            {registration.registered_display_name || getStarDisplayName(star)}
                                        </h1>
                                        <p className="muted-copy" style={{ maxWidth: 760 }}>
                                            A public star page in Aster Atlas, built around a real catalogued star and a private registry record.
                                        </p>
                                    </div>

                                    <div className="status-grid">
                                        <div className="glass-card" style={{ padding: '20px 22px' }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Registration number</div>
                                            <strong style={{ fontSize: '1.15rem' }}>{registration.registration_number}</strong>
                                        </div>
                                        <div className="glass-card" style={{ padding: '20px 22px' }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Ownership</div>
                                            <strong style={{ fontSize: '1.15rem' }}>{registration.current_holder_username || 'Not shared yet'}</strong>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: 24 }}>
                                <article className="glass-card" style={{ padding: '32px 30px' }}>
                                    <p className="eyebrow" style={{ marginBottom: 14 }}>Registry record</p>
                                    <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', marginBottom: 12 }}>A lasting record with real star data behind it.</h2>
                                    <p className="muted-copy" style={{ marginBottom: 18 }}>
                                        This record sits inside the Aster Atlas private celestial registry. It does not replace the star&apos;s scientific designation or claim official naming authority.
                                    </p>
                                    {registration.dedication ? (
                                        <div className="glass-card" style={{ padding: '22px 22px', background: 'var(--surface-warm)', marginBottom: 16 }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Dedication</div>
                                            <p style={{ color: 'var(--text-primary)', lineHeight: 1.75, margin: 0 }}>{registration.dedication}</p>
                                        </div>
                                    ) : null}
                                    <div className="glass-card" style={{ padding: '22px 22px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 8 }}>Why this star</div>
                                        <p className="muted-copy" style={{ margin: 0 }}>
                                            A richer story section can be added here later. For now, the record remains anchored by the star&apos;s real catalogue details and its Aster Atlas registration.
                                        </p>
                                    </div>
                                </article>

                                <aside className="glass-card" style={{ padding: '32px 30px' }}>
                                    <p className="eyebrow" style={{ marginBottom: 14 }}>Star facts</p>
                                    <div style={{ display: 'grid', gap: 14 }}>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Catalogue reference</div>
                                            <strong>{star.source_catalog || 'Catalogue'} {star.source_id || star.catalog_id || star.gaia_source_id || 'Listed star'}</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Scientific name</div>
                                            <strong>{star.scientific_name}</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Constellation</div>
                                            <strong>{star.constellation || 'Not listed'}</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Distance from Sun</div>
                                            <strong>{star.distance_ly?.toFixed?.(2) || star.distance_ly} light years</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Star type</div>
                                            <strong>{star.category}</strong>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Registry visibility</div>
                                            <strong>{registration.public_page_visibility}</strong>
                                        </div>
                                    </div>
                                </aside>
                            </section>

                            <section className="glass-card" style={{ padding: '30px 30px', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div>
                                    <p className="eyebrow" style={{ marginBottom: 10 }}>Aster Atlas</p>
                                    <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', marginBottom: 10 }}>Continue from the atlas or register another star.</h2>
                                    <p className="muted-copy" style={{ margin: 0 }}>Public visitors can explore this record. Account holders can return later to manage private ownership details.</p>
                                </div>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <Link to={`/search/${getStarSlug(star)}`} className="secondary-button">View in atlas</Link>
                                    <Link to="/buy" className="primary-button">Find a Star</Link>
                                </div>
                            </section>
                        </>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default StarWikiPage;
