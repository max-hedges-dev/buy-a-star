import React from 'react';
import { motion } from 'framer-motion';

const pageWidth = {
    maxWidth: '1180px',
    margin: '0 auto',
};

const eyebrowStyle = {
    color: '#ff9150',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: '0.82rem',
    marginBottom: '18px',
};

const paragraphStyle = {
    color: '#b7b7be',
    lineHeight: 1.9,
    fontSize: '1.08rem',
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
                <div style={eyebrowStyle}>{eyebrow}</div>
                <h2
                    style={{
                        fontSize: 'clamp(1.75rem, 3vw, 2.35rem)',
                        lineHeight: 1.15,
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
                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                        paddingLeft: '32px',
                        minHeight: '100%',
                    }}
                >
                    <div
                        style={{
                            color: '#ffffff',
                            fontSize: '1.35rem',
                            lineHeight: 1.25,
                            marginBottom: '14px',
                            fontWeight: 600,
                        }}
                    >
                        {sidePanel.title}
                    </div>
                    <p
                        style={{
                            color: '#b7b7be',
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
                    radial-gradient(circle at 20% 10%, rgba(255,90,20,0.08), transparent 24%),
                    linear-gradient(180deg, #090909 0%, #050505 100%)
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
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div style={eyebrowStyle}>ABOUT ASTER ATLAS</div>
                    <h1
                        style={{
                            fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
                            lineHeight: 1.02,
                            marginBottom: '24px',
                            textTransform: 'uppercase',
                            maxWidth: '980px',
                        }}
                    >
                        A PRIVATE CELESTIAL REGISTRY BUILT ON REAL STAR DATA
                    </h1>
                    <p style={{ ...paragraphStyle, fontSize: '1.14rem', marginBottom: '18px', maxWidth: '900px' }}>
                        Aster Atlas is a private celestial registry built around real catalogued stars. It allows a star to be selected, recorded in the registry, and issued with a certificate and permanent star record inside the atlas.
                    </p>
                    <p style={{ ...paragraphStyle, maxWidth: '900px' }}>
                        Each entry is tied to an actual astronomical source record rather than an invented listing. The purpose of Aster Atlas is not to claim scientific naming authority, but to provide a clear and lasting private registry for people who want to register a star properly.
                    </p>
                </motion.header>

                <Section
                    eyebrow="DATA SOURCE"
                    headline="Gaia Data Release 3"
                    paragraphs={[
                        'Aster Atlas uses modern star catalogue data as the basis for its records, with the third major data set from the European Space Agency\'s Gaia mission (Gaia DR3) forming the core reference source. That gives each registered star a real astronomical identifier and a consistent set of star details.',
                        'The registry uses this data to identify and display the star clearly. This includes the star’s catalogue reference and key recorded properties used in the atlas and on the certificate.',
                    ]}
                    sidePanel={{
                        title: 'Why Gaia',
                        body: 'Gaia is the European Space Agency mission and data archive built to map the Milky Way with high-precision star positions and related measurements. Using Gaia-based data gives the registry a real astronomical foundation instead of an invented list of names.',
                    }}
                />

                <Section
                    eyebrow="WHY WE STARTED IT"
                    headline="Most star registries stop at the certificate"
                    paragraphs={[
                        'Many star-gift sites are built around a single novelty outcome: a certificate with very little structure behind it. The registry itself is often unclear, the data is thin, and the star is difficult to revisit in any meaningful way after purchase.',
                        'Aster Atlas was founded to take a more structured approach. The idea was simple: if a star is being registered, the registry should be real in the sense that it is organised, searchable, tied to actual star data, and clearly recorded.',
                        'That is why Aster Atlas is built around formal star records, a persistent registry, and an atlas that allows the star to be found again later.',
                    ]}
                />

                <Section
                    eyebrow="WHAT A REGISTRATION MEANS"
                    headline="A private record, not a scientific renaming"
                    paragraphs={[
                        'Aster Atlas is a private registry. Registering a star creates a record for that star within Aster Atlas, together with the selected registration details and certificate.',
                        'It does not replace the star’s scientific designation and it does not claim to act as an international naming authority. The scientific catalogue reference remains in place, and the Aster Atlas registration sits alongside it as a private recorded entry.',
                    ]}
                />

                <Section
                    eyebrow="VISION"
                    headline="A long-term registry, not a one-time novelty product"
                    paragraphs={[
                        'The long-term aim is to build Aster Atlas into a durable celestial registry with a large searchable catalogue, stable star records, and a presentation standard that remains consistent as the platform grows.',
                        'Over time, that includes expanding the atlas, improving the depth of each star record, refining the certificate and ownership record, and adding more ways for registered stars to be revisited and managed inside the registry.',
                        'The intention is straightforward: to build a star registry that is structured properly, based on real astronomical data, and recognised for the quality of its records.',
                    ]}
                />
            </div>
        </section>
    );
};

export default AboutSection;
