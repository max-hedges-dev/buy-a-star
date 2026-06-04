import React, { useEffect, useState } from 'react';
import { CheckCircle2, Heart, Search, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import certificateExample from '../assets/Certificate Example.png';

const sectionWidth = {
    maxWidth: '1240px',
    margin: '0 auto',
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const panelStyle = {
    background: 'linear-gradient(180deg, rgba(23,26,33,0.92) 0%, rgba(16,18,23,0.96) 100%)',
    border: '1px solid rgba(245,239,226,0.08)',
    borderRadius: '28px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
};

const primaryButtonStyle = {
    padding: '16px 34px',
    background: 'var(--cta-gradient)',
    color: '#070a11',
    fontWeight: '700',
    letterSpacing: '0.08em',
    borderRadius: '999px',
    boxShadow: 'var(--shadow-warm)',
    border: '1px solid rgba(245,239,226,0.18)',
    fontSize: '0.95rem',
    textDecoration: 'none',
    textTransform: 'uppercase',
};

const secondaryButtonStyle = {
    padding: '16px 34px',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-color)',
    fontWeight: '700',
    letterSpacing: '0.08em',
    borderRadius: '999px',
    border: '1px solid rgba(216,168,95,0.22)',
    fontSize: '0.95rem',
    backdropFilter: 'blur(14px)',
    textDecoration: 'none',
    textTransform: 'uppercase',
};

const SectionHeader = ({ eyebrow, headline, body, centered = false }) => (
    <div style={{ textAlign: centered ? 'center' : 'left' }}>
        {eyebrow && (
            <div
                style={{
                    color: 'var(--primary-strong)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    marginBottom: '18px',
                }}
            >
                {eyebrow}
            </div>
        )}
        <h2
            style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2.4rem, 4.6vw, 4rem)',
                fontWeight: 600,
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                marginBottom: body ? '18px' : 0,
                color: 'var(--text-color)',
            }}
        >
            {headline}
        </h2>
        {body && (
            <p
                style={{
                    color: 'var(--text-secondary)',
                    lineHeight: 1.85,
                    fontSize: '1.06rem',
                    maxWidth: centered ? '780px' : '720px',
                    margin: centered ? '0 auto' : 0,
                }}
            >
                {body}
            </p>
        )}
    </div>
);

const SmallCard = ({ title, body }) => (
    <div
        style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(245,239,226,0.08)',
            borderRadius: '22px',
            padding: '26px 24px',
            minHeight: '100%',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
    >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.42rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-color)' }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>{body}</div>
    </div>
);

const StepCard = ({ icon: Icon, number, title, body }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, delay: number * 0.08 }}
        style={{
            ...panelStyle,
            padding: '32px 28px',
        }}
    >
        <div
            style={{
                width: '62px',
                height: '62px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(216,168,95,0.22) 0%, rgba(184,107,94,0.08) 100%)',
                border: '1px solid rgba(216,168,95,0.16)',
                marginBottom: '20px',
            }}
        >
            <Icon size={28} color="var(--primary-strong)" />
        </div>
        <div style={{ color: 'var(--primary-strong)', fontSize: '0.75rem', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
            Step {number}
        </div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', fontWeight: 600, marginBottom: '12px', lineHeight: 1.08 }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>{body}</p>
    </motion.div>
);

const Features = () => {
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
    }));

    useEffect(() => {
        const handleResize = () => setViewportSize({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const { width: viewportWidth, height: viewportHeight } = viewportSize;
    const sectionScale = clamp(Math.min(viewportWidth / 1440, viewportHeight / 920), 0.72, 1.04);
    const isCompact = viewportWidth < 920;
    const sectionPaddingX = Math.round(clamp(40 * sectionScale, 18, 40));
    const sectionPaddingTop = Math.round(clamp(120 * sectionScale, 70, 120));
    const sectionPaddingBottom = Math.round(clamp(130 * sectionScale, 76, 130));
    const panelPadding = Math.round(clamp(24 * sectionScale, 16, 24));
    const cardMinWidth = Math.round(clamp(245 * sectionScale, 210, 260));
    const stepMinWidth = Math.round(clamp(300 * sectionScale, 240, 330));
    const featureGap = Math.round(clamp(24 * sectionScale, 16, 24));
    const sectionGapLarge = Math.round(clamp(110 * sectionScale, 58, 110));
    const certificateTextAlign = isCompact ? 'center' : 'left';

    const whyCards = [
        {
            title: 'Real catalogued stars',
            body: 'Every registration begins with an actual astronomical source record, not an invented point of light.',
        },
        {
            title: 'Private registry record',
            body: 'Each star can be registered once within Aster Atlas, creating a clear private record for the chosen name or dedication.',
        },
        {
            title: 'Searchable in the Atlas',
            body: 'Registered stars can be searched, opened, and revisited through the atlas instead of disappearing after checkout.',
        },
        {
            title: 'Certificate included',
            body: 'Digital certificates are issued after registration with the selected star, registered details, and Aster Atlas record.',
        },
    ];

    const steps = [
        {
            title: 'Find the right star.',
            body: 'Browse the atlas and choose a star by distance, colour, constellation, type, or simple personal preference.',
            icon: Search,
        },
        {
            title: 'Make it personal.',
            body: 'Add the name, dedication, or registration details that explain who the star is for and why it matters.',
            icon: Heart,
        },
        {
            title: 'Record and revisit it.',
            body: 'Receive the certificate and return to the star’s record whenever you want to view it again inside Aster Atlas.',
            icon: CheckCircle2,
        },
    ];

    return (
        <section
            style={{
                position: 'relative',
                padding: `${sectionPaddingTop}px ${sectionPaddingX}px ${sectionPaddingBottom}px`,
                background: `
                    radial-gradient(circle at 50% 0%, rgba(216,168,95,0.1), transparent 28%),
                    radial-gradient(circle at 85% 18%, rgba(122,92,255,0.08), transparent 22%),
                    linear-gradient(180deg, #070a11 0%, #020305 100%)
                `,
                zIndex: 2,
            }}
        >
            <div style={sectionWidth}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.75 }}
                    style={{ marginBottom: `${Math.round(clamp(72 * sectionScale, 44, 72))}px` }}
                >
                    <SectionHeader
                        eyebrow="WHY ASTER ATLAS"
                        headline="A private registry, not a throwaway gift."
                        body="Aster Atlas is built around real catalogued stars, clear private records, and a visual atlas you can return to. Each registration creates a certificate, a searchable star record, and a page that gives the star somewhere to live after purchase."
                        centered
                    />

                    <div
                        style={{
                            ...panelStyle,
                            marginTop: `${Math.round(clamp(38 * sectionScale, 24, 38))}px`,
                            padding: `${panelPadding}px`,
                            background: `
                                radial-gradient(circle at top, rgba(216,168,95,0.08), transparent 34%),
                                linear-gradient(180deg, rgba(23,26,33,0.92) 0%, rgba(16,18,23,0.98) 100%)
                            `,
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${cardMinWidth}px), 1fr))`,
                                gap: `${Math.round(clamp(16 * sectionScale, 12, 16))}px`,
                            }}
                        >
                            {whyCards.map((card) => (
                                <SmallCard key={card.title} title={card.title} body={card.body} />
                            ))}
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.75 }}
                    style={{ marginBottom: `${sectionGapLarge}px` }}
                >
                    <div
                        style={{
                            width: '72px',
                            height: '1px',
                            margin: `${Math.round(clamp(10 * sectionScale, 6, 10))}px auto ${Math.round(clamp(68 * sectionScale, 42, 68))}px`,
                            background: 'rgba(245,239,226,0.5)',
                            boxShadow: '0 0 14px rgba(216,168,95,0.14)',
                        }}
                    />

                    <div style={{ transform: 'translateY(-22px)' }}>
                        <SectionHeader eyebrow="HOW IT WORKS" centered />
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${stepMinWidth}px), 1fr))`,
                            gap: `${featureGap}px`,
                            marginTop: `${Math.round(clamp(20 * sectionScale, 12, 20))}px`,
                        }}
                    >
                        {steps.map((step, index) => (
                            <StepCard
                                key={step.title}
                                icon={step.icon}
                                number={index + 1}
                                title={step.title}
                                body={step.body}
                            />
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.75 }}
                    style={{ marginBottom: `${sectionGapLarge}px` }}
                >
                    <div
                        style={{
                            width: '72px',
                            height: '1px',
                            margin: `0 auto ${Math.round(clamp(88 * sectionScale, 46, 88))}px`,
                            background: 'rgba(245,239,226,0.5)',
                            boxShadow: '0 0 14px rgba(216,168,95,0.14)',
                        }}
                    />

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isCompact ? '1fr' : '0.9fr 1.1fr',
                            gap: `${Math.round(clamp(48 * sectionScale, 26, 48))}px`,
                            alignItems: 'center',
                            textAlign: certificateTextAlign,
                        }}
                    >
                    <div style={{ maxWidth: isCompact ? '720px' : 'none', margin: isCompact ? '0 auto' : 0 }}>
                        <SectionHeader
                            headline="A certificate with something behind it."
                            body="After registration, you receive a digital certificate tied to a persistent star record inside Aster Atlas — not just an isolated image."
                            centered={isCompact}
                        />

                        <div style={{ display: 'grid', gap: `${Math.round(clamp(14 * sectionScale, 10, 14))}px`, marginTop: `${Math.round(clamp(24 * sectionScale, 18, 24))}px`, justifyItems: isCompact ? 'center' : 'start' }}>
                            {[
                                'Delivered digitally after registration.',
                                'Shows the registered name or dedication and selected star.',
                                'Connected to a searchable record in the Atlas.',
                            ].map((line) => (
                                <div
                                    key={line}
                                    style={{
                                        display: 'flex',
                                        gap: '14px',
                                        alignItems: 'flex-start',
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.7,
                                        textAlign: 'left',
                                        maxWidth: isCompact ? '520px' : 'none',
                                    }}
                                >
                                    <CheckCircle2 size={18} color="var(--primary-strong)" style={{ marginTop: '5px', flexShrink: 0 }} />
                                    <span>{line}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: isCompact ? '760px' : '1120px',
                            justifySelf: isCompact ? 'center' : 'stretch',
                            padding: `${Math.round(clamp(18 * sectionScale, 10, 18))}px`,
                            borderRadius: `${Math.round(clamp(34 * sectionScale, 22, 34))}px`,
                            background: 'linear-gradient(135deg, rgba(216,168,95,0.08) 0%, rgba(255,255,255,0.02) 34%, rgba(184,107,94,0.08) 100%)',
                            border: '1px solid rgba(216,168,95,0.16)',
                            boxShadow: '0 30px 120px rgba(0,0,0,0.45)',
                        }}
                    >
                        <img
                            src={certificateExample}
                            alt="Example Aster Atlas certificate"
                            style={{
                                display: 'block',
                                width: '100%',
                                height: 'auto',
                                borderRadius: `${Math.round(clamp(26 * sectionScale, 16, 26))}px`,
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        />
                    </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.75 }}
                    style={{
                        ...panelStyle,
                        textAlign: 'center',
                        padding: `${Math.round(clamp(56 * sectionScale, 34, 56))}px ${Math.round(clamp(40 * sectionScale, 20, 40))}px`,
                    }}
                >
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(2.4rem, 4vw, 3.6rem)', lineHeight: 0.98, marginBottom: '18px' }}>
                        Give a star they can return to.
                    </h3>
                    <p style={{ maxWidth: '760px', margin: '0 auto 30px', color: 'var(--text-secondary)', lineHeight: 1.85, fontSize: '1.08rem' }}>
                        Whether it is a meaningful gift for someone you love or a lasting keepsake for yourself, Aster Atlas helps make the moment feel personal, recorded, and beautifully preserved.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: `${Math.round(clamp(16 * sectionScale, 10, 16))}px`, flexWrap: 'wrap' }}>
                        <Link to="/buy" style={primaryButtonStyle}>
                            Find a Star
                        </Link>
                        <Link to="/search" style={secondaryButtonStyle}>
                            Explore the Atlas
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default Features;
