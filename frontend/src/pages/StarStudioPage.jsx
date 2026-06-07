import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';

const pageStyle = {
    minHeight: '100vh',
    background: `
        radial-gradient(circle at top center, rgba(255,101,24,0.18), transparent 24%),
        radial-gradient(circle at 14% 24%, rgba(0,188,212,0.11), transparent 20%),
        linear-gradient(180deg, #040404 0%, #090909 100%)
    `,
};

const studioCards = [
    {
        title: 'Create certificate',
        body: 'Build your certificate wording and choose how it should feel when you are ready.',
    },
    {
        title: 'Add dedication',
        body: 'Write a dedication or note that can live alongside the star record later.',
    },
    {
        title: 'Write star story',
        body: 'Capture why this star matters and shape the story you want to keep with it.',
    },
    {
        title: 'Generate matching report',
        body: 'Matching guidance can live here in a later phase without affecting your purchase today.',
    },
    {
        title: 'Create social media assets',
        body: 'Turn the star into a shareable post or story pack when you want to reveal it.',
    },
    {
        title: 'Explore physical add-ons',
        body: 'Printed pieces and keepsakes can be added from here once the product options settle.',
    },
];

const StarStudioPage = () => {
    const [searchParams] = useSearchParams();
    const registrationId = searchParams.get('registration');
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 920 });
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const heroPadding = `${px(42)}px ${px(40)}px`;
    const cardPadding = `${px(26)}px ${px(28)}px`;

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `calc(var(--nav-height) + ${px(42)}px) ${pagePaddingX}px ${px(90)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    <section className="glass-card" style={{ padding: heroPadding }}>
                        <p className="eyebrow" style={{ marginBottom: 16 }}>Star Studio</p>
                        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.95, marginBottom: 16 }}>
                            Personalise your star when you are ready.
                        </h1>
                        <p className="muted-copy" style={{ maxWidth: 760, marginBottom: 24 }}>
                            Your purchase is already complete. Star Studio is the creative place you can return to anytime for certificates, dedication text, gift materials, and shareable assets.
                        </p>
                        <div className="status-banner">
                            You can come back to Star Studio anytime from My Stars.
                        </div>
                        {registrationId ? (
                            <div style={{ marginTop: 18 }}>
                                <Link to={`/account/registrations/${registrationId}`} className="secondary-button">
                                    Back to this star
                                </Link>
                            </div>
                        ) : null}
                    </section>

                    <section
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                            gap: px(18),
                        }}
                    >
                        {studioCards.map((card) => (
                            <article
                                key={card.title}
                                className="glass-card"
                                style={{ padding: cardPadding, display: 'grid', gap: 10 }}
                            >
                                <p className="eyebrow" style={{ margin: 0 }}>Coming together</p>
                                <h2 style={{ fontSize: '1.45rem', margin: 0 }}>{card.title}</h2>
                                <p className="muted-copy" style={{ margin: 0 }}>{card.body}</p>
                            </article>
                        ))}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default StarStudioPage;
