import React from 'react';
import { motion } from 'framer-motion';

const pageWidth = {
    maxWidth: '1180px',
    margin: '0 auto',
};

const eyebrowStyle = {
    color: 'var(--primary-strong)',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: '0.78rem',
    marginBottom: '18px',
};

const paragraphStyle = {
    color: 'var(--text-secondary)',
    lineHeight: 1.9,
    fontSize: '1.06rem',
    maxWidth: '860px',
};

const sectionSpacing = {
    marginBottom: '92px',
};

const Section = ({ eyebrow, headline, paragraphs, sidePanel }) => (
    <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
        style={sectionSpacing}
    >
        <div
            style={{
                display: sidePanel ? 'grid' : 'block',
                gridTemplateColumns: sidePanel ? '1.1fr 0.9fr' : undefined,
                gap: sidePanel ? '48px' : undefined,
                alignItems: 'start',
            }}
        >
            <div>
                {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
                <h2
                    style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 'clamp(2rem, 3vw, 2.8rem)',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        marginBottom: '22px',
                        fontWeight: 600,
                        maxWidth: '920px',
                    }}
                >
                    {headline}
                </h2>
                {paragraphs.map((paragraph, index) => (
                    <p
                        key={paragraph}
                        style={{
                            ...paragraphStyle,
                            marginBottom: index === paragraphs.length - 1 ? 0 : '18px',
                        }}
                    >
                        {paragraph}
                    </p>
                ))}
            </div>

            {sidePanel && (
                <aside
                    style={{
                        borderLeft: '1px solid rgba(245,239,226,0.08)',
                        paddingLeft: '32px',
                        minHeight: '100%',
                    }}
                >
                    <div
                        style={{
                            color: 'var(--text-color)',
                            fontFamily: 'var(--font-serif)',
                            fontSize: '1.7rem',
                            lineHeight: 1.05,
                            marginBottom: '14px',
                            fontWeight: 600,
                        }}
                    >
                        {sidePanel.title}
                    </div>
                    <p
                        style={{
                            color: 'var(--text-secondary)',
                            lineHeight: 1.8,
                            fontSize: '1rem',
                            maxWidth: '420px',
                        }}
                    >
                        {sidePanel.body}
                    </p>
                </aside>
            )}
        </div>
    </motion.section>
);

const AboutSection = () => {
    return (
        <section
            id="about"
            style={{
                padding: '120px 40px 140px',
                background: `
                    radial-gradient(circle at 20% 10%, rgba(200,121,58,0.08), transparent 24%),
                    radial-gradient(circle at 80% 16%, rgba(93,130,184,0.08), transparent 24%),
                    linear-gradient(180deg, #070a11 0%, #020305 100%)
                `,
                position: 'relative',
                zIndex: 2,
            }}
        >
            <div style={pageWidth}>
                <motion.header
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.7 }}
                    style={{
                        paddingBottom: '56px',
                        marginBottom: '68px',
                        borderBottom: '1px solid rgba(245,239,226,0.08)',
                    }}
                >
                    <div style={eyebrowStyle}>ABOUT ASTER ATLAS</div>
                    <h1
                        style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: 'clamp(3rem, 5vw, 4.9rem)',
                            lineHeight: 0.95,
                            letterSpacing: '-0.02em',
                            marginBottom: '24px',
                            maxWidth: '980px',
                            fontWeight: 600,
                        }}
                    >
                        A private celestial registry for meaningful star records.
                    </h1>
                    <p style={{ ...paragraphStyle, fontSize: '1.12rem', marginBottom: '18px', maxWidth: '900px' }}>
                        Aster Atlas is a private celestial registry built around real catalogued stars. It helps people choose, register, and revisit a star through a lasting record, certificate, and atlas page.
                    </p>
                    <p style={{ ...paragraphStyle, maxWidth: '900px' }}>
                        The aim is not to replace scientific naming authority. The aim is to make a selected star feel findable, personal, and properly recorded inside a private registry.
                    </p>
                </motion.header>

                <Section
                    eyebrow="DATA SOURCE"
                    headline="Built on real catalogue data."
                    paragraphs={[
                        'Aster Atlas uses modern star catalogue data as the basis for its records. Each registered star is tied to an astronomical source entry, giving every record a real point of reference rather than an invented listing.',
                        'This foundation allows each star to be displayed, searched, and recorded consistently across the atlas, the certificate, and the ownership area.',
                    ]}
                    sidePanel={{
                        title: 'Why Gaia matters.',
                        body: 'Gaia is a European Space Agency mission that mapped the Milky Way with high-precision star positions and related measurements. Gaia-based data gives Aster Atlas a real astronomical foundation while the private registry layer records the chosen name, dedication, and ownership details within Aster Atlas.',
                    }}
                />

                <Section
                    eyebrow="WHY WE STARTED IT"
                    headline="Most star gifts end at the certificate."
                    paragraphs={[
                        'Many star-gift sites are built around a single novelty outcome: a certificate with very little structure behind it. The registry is often unclear, the data is thin, and the star is difficult to revisit in any meaningful way after purchase.',
                        'Aster Atlas was founded to take a more structured approach. If a star is being registered, the record should be organised, searchable, tied to real star data, and easy to return to later.',
                        'That is why Aster Atlas is built around formal star records, a persistent private registry, and an atlas that allows each registered star to be found again.',
                    ]}
                />

                <Section
                    eyebrow="WHAT A REGISTRATION MEANS"
                    headline="A private record, not a scientific rename."
                    paragraphs={[
                        'Aster Atlas is a private registry. Registering a star creates a record for that star within Aster Atlas, together with the selected registration details and certificate.',
                        'It does not replace the star’s scientific designation and it does not claim to act as an international naming authority. The scientific catalogue reference remains in place, and the Aster Atlas registration sits alongside it as a private recorded entry.',
                    ]}
                />

                <Section
                    eyebrow="VISION"
                    headline="A lasting atlas, not a one-time novelty product."
                    paragraphs={[
                        'The long-term aim is to build Aster Atlas into a durable celestial registry with a searchable catalogue, stable star records, and a presentation standard that remains consistent as the platform grows.',
                        'Over time, the atlas can support richer star pages, stronger gifting journeys, clearer ownership records, and more ways for registered stars to be revisited, shared, and understood.',
                        'The intention is straightforward: build a star registry that is structured properly, based on real astronomical data, and recognised for the quality of its records.',
                    ]}
                />
            </div>
        </section>
    );
};

export default AboutSection;
