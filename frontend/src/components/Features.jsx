import React from 'react';
import { CheckCircle2, Star, Waypoints } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import certificateExample from '../assets/Certificate Example.png';

const sectionWidth = {
    maxWidth: '1240px',
    margin: '0 auto',
};

const panelStyle = {
    background: 'linear-gradient(180deg, rgba(18,18,18,0.92) 0%, rgba(10,10,10,0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '28px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
};

const primaryButtonStyle = {
    padding: '16px 34px',
    background: 'linear-gradient(45deg, #ff4d00, #ff8800)',
    color: 'white',
    fontWeight: '700',
    letterSpacing: '0.08em',
    borderRadius: '999px',
    boxShadow: '0 0 24px rgba(255, 77, 0, 0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    fontSize: '0.95rem',
    textDecoration: 'none',
};

const secondaryButtonStyle = {
    padding: '16px 34px',
    background: 'rgba(255,255,255,0.04)',
    color: 'white',
    fontWeight: '700',
    letterSpacing: '0.08em',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.14)',
    fontSize: '0.95rem',
    backdropFilter: 'blur(14px)',
    textDecoration: 'none',
};

const SectionHeader = ({ eyebrow, headline, body, centered = false }) => (
    <div style={{ textAlign: centered ? 'center' : 'left' }}>
        {eyebrow && (
            <div
                style={{
                    color: '#ff9150',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    marginBottom: '18px',
                }}
            >
                {eyebrow}
            </div>
        )}
        <h2
            style={{
                fontSize: 'clamp(2.4rem, 4.6vw, 4rem)',
                lineHeight: 1.04,
                marginBottom: body ? '18px' : 0,
                textTransform: eyebrow === 'WHY ASTER ATLAS' ? 'uppercase' : 'none',
            }}
        >
            {headline}
        </h2>
        {body && (
            <p
                style={{
                    color: '#b7b7be',
                    lineHeight: 1.85,
                    fontSize: '1.08rem',
                    maxWidth: centered ? '760px' : '720px',
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.025) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '22px',
            padding: '26px 24px',
            minHeight: '100%',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
    >
        <div style={{ fontSize: '1.12rem', fontWeight: 700, marginBottom: '10px' }}>{title}</div>
        <div style={{ color: '#a8a8b0', lineHeight: 1.8 }}>{body}</div>
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
                background: 'linear-gradient(135deg, rgba(255,92,0,0.22) 0%, rgba(255,132,0,0.08) 100%)',
                border: '1px solid rgba(255,132,0,0.16)',
                marginBottom: '20px',
            }}
        >
            <Icon size={28} color="#ff7a1f" />
        </div>
        <div style={{ color: '#ff9c63', fontSize: '0.75rem', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
            Step {number}
        </div>
        <h3 style={{ fontSize: '1.45rem', marginBottom: '12px', lineHeight: 1.18 }}>{title}</h3>
        <p style={{ color: '#b7b7be', lineHeight: 1.75 }}>{body}</p>
    </motion.div>
);

const CertificatePreview = () => (
    <div
        style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1120px',
            padding: '18px',
            borderRadius: '34px',
            background: 'linear-gradient(135deg, rgba(255,182,120,0.08) 0%, rgba(255,255,255,0.02) 34%, rgba(255,99,32,0.08) 100%)',
            border: '1px solid rgba(255,190,120,0.16)',
            boxShadow: '0 30px 120px rgba(0,0,0,0.45)',
        }}
    >
        <div
            style={{
                position: 'relative',
                background: 'linear-gradient(145deg, #f7edd7 0%, #ead7b1 42%, #dcc49a 100%)',
                borderRadius: '26px',
                border: '1px solid rgba(88,52,21,0.18)',
                overflow: 'hidden',
                aspectRatio: '1.58 / 1',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: '14px',
                    borderRadius: '18px',
                    border: '1px solid rgba(90,58,24,0.22)',
                    pointerEvents: 'none',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: '28px',
                    borderRadius: '14px',
                    border: '2px solid rgba(89,53,20,0.18)',
                    pointerEvents: 'none',
                }}
            />

            <div style={{ padding: '54px 60px 48px', color: '#3a2615', position: 'relative', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '42px', gap: '30px' }}>
                    <div>
                        <div style={{ fontSize: '0.76rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a5d2d', marginBottom: '18px', fontWeight: 700 }}>
                            Aster Atlas Celestial Registry
                        </div>
                        <h3 style={{ fontFamily: 'Georgia, Times New Roman, serif', fontSize: '3.2rem', lineHeight: 1.04, marginBottom: '14px', color: '#2e1d10' }}>
                            Certificate
                        </h3>
                        <p style={{ maxWidth: '460px', lineHeight: 1.7, color: '#6f543a', fontSize: '1.02rem' }}>
                            Issued as part of the registry record
                        </p>
                    </div>
                    <div
                        style={{
                            width: '116px',
                            height: '116px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 35% 35%, #fff2c7 0%, #dca14a 36%, #91551d 100%)',
                            boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.42), 0 18px 30px rgba(89,48,16,0.16)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(110,57,16,0.25)',
                            flexShrink: 0,
                        }}
                    >
                        <Star size={34} color="#5f3516" />
                    </div>
                </div>

                <div style={{ paddingTop: '8px' }}>
                    <div style={{ color: '#8a5d2d', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.82rem', marginBottom: '18px' }}>
                        Certificate
                    </div>
                    <div style={{ fontFamily: 'Georgia, Times New Roman, serif', fontSize: '4.2rem', lineHeight: 0.98, color: '#c95614', marginBottom: '22px' }}>
                        Certificate
                    </div>
                    <div style={{ color: '#6f543a', fontSize: '1.1rem', maxWidth: '560px', lineHeight: 1.8 }}>
                        The certificate is the formal document attached to the registration. It includes the registered name, the catalog reference, and the key star details.
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1.08fr 0.92fr',
                        gap: '34px',
                        alignItems: 'start',
                        marginBottom: '44px',
                    }}
                >
                    {[
                        'Delivered digitally immediately after purchase.',
                        'Shows the registered name and catalog reference.',
                        'Linked to the star’s record in Aster Atlas.',
                    ].map((line) => (
                        <div
                            key={line}
                            style={{
                                background: 'rgba(255,255,255,0.22)',
                                border: '1px solid rgba(104,68,33,0.16)',
                                borderRadius: '20px',
                                padding: '20px 18px',
                                fontSize: '0.95rem',
                                lineHeight: 1.6,
                                color: '#5a4028',
                            }}
                        >
                            {line}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ width: '220px', height: '1px', background: 'rgba(86,58,28,0.45)' }} />
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ width: '220px', height: '1px', background: 'rgba(86,58,28,0.45)', marginBottom: '16px' }} />
                        <div style={{ width: '180px', height: '1px', background: 'rgba(86,58,28,0.3)', marginLeft: 'auto' }} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const Features = () => {
    const whyCards = [
        {
            title: 'Real Stars',
            body: 'We are the world\'s largest star registry and offer real stars across the entire milky way galaxy.',
        },
        {
            title: 'Real Ownership',
            body: 'Each star can only be owned once. By a single person. Owners will be forever immortalised within the registry.',
        },
        {
            title: 'Searchable',
            body: 'Registered stars and their owners can be found again through our unique galaxy-view.',
        },
        {
            title: 'Delivered Quickly',
            body: 'Ownership details and igital certificates are issued immediately after purchase. Physical certificates are coming soon.',
        },
    ];

    const steps = [
        {
            title: 'Choose a star.',
            body: 'Select a real catalogued star from the registry either though the star listings page or through the galaxy-view.',
            icon: Star,
        },
        {
            title: 'Add the registration details.',
            body: 'Enter the name or dedication for the registry record and certificate. This can be for youself or for someone else.',
            icon: Waypoints,
        },
        {
            title: 'Obtain full ownership.',
            body: 'The completed registration and digital certificate are issued immediately. You will also be able to search through the galaxy and find the star owner. ',
            icon: CheckCircle2,
        },
    ];

    return (
        <section
            style={{
                position: 'relative',
                padding: '120px 40px 130px',
                background: `
                    radial-gradient(circle at 50% 0%, rgba(255,101,24,0.12), transparent 28%),
                    linear-gradient(180deg, #050505 0%, #090909 100%)
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
                    style={{ marginBottom: '72px' }}
                >
                    <SectionHeader
                        eyebrow="WHY ASTER ATLAS?"
                        headline="A REGISTRY, NOT A NOVELTY"
                        body="Aster Atlas is built around clear registry records and ownership, real catalogued stars from the latest Gaia Data Release, and a one-of-a-kind visual representation. Each order includes a registered entry, a digital certificate, and a star record that can be searched and revisited forever in our Milky Way galaxy simulation."
                        centered
                    />

                    <div
                        style={{
                            ...panelStyle,
                            marginTop: '38px',
                            padding: '24px',
                            background: `
                                radial-gradient(circle at top, rgba(255,118,44,0.08), transparent 34%),
                                linear-gradient(180deg, rgba(18,18,18,0.92) 0%, rgba(10,10,10,0.98) 100%)
                            `,
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                gap: '16px',
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
                    style={{ marginBottom: '110px' }}
                >
                    <div
                        style={{
                            width: '72px',
                            height: '1px',
                            margin: '10px auto 68px',
                            background: 'rgba(255,255,255,0.78)',
                            boxShadow: '0 0 14px rgba(255,255,255,0.12)',
                        }}
                        
                    />

                    <div style={{ transform: 'translateY(-22px)' }}>
                        <SectionHeader eyebrow="HOW IT WORKS" centered />
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: '24px',
                            marginTop: '20px',
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
                    style={{ marginBottom: '110px' }}
                >
                    <div
                        style={{
                            width: '72px',
                            height: '1px',
                            margin: '0 auto 88px',
                            background: 'rgba(255,255,255,0.78)',
                            boxShadow: '0 0 14px rgba(255,255,255,0.12)',
                        }}
                    />

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '0.9fr 1.1fr',
                            gap: '48px',
                            alignItems: 'center',
                        }}
                    >
                    <div>
                        <SectionHeader
                            headline="IMMEDIATE PROOF OF OWNERSHIP"
                            body="After purchasing a star, you'll immediately receive a formal certificate of registration of celestial ownership."
                        />

                        <div style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
                            {[
                                'Delivered digitally immediately after purchase.',
                                'Displays the owner name the owned star.',
                                'Physical certificates coming soon.',
                            ].map((line) => (
                                <div
                                    key={line}
                                    style={{
                                        display: 'flex',
                                        gap: '14px',
                                        alignItems: 'flex-start',
                                        color: '#ddd',
                                        lineHeight: 1.7,
                                    }}
                                >
                                    <CheckCircle2 size={18} color="#ff7a1f" style={{ marginTop: '5px', flexShrink: 0 }} />
                                    <span>{line}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '1120px',
                            padding: '18px',
                            borderRadius: '34px',
                            background: 'linear-gradient(135deg, rgba(255,182,120,0.08) 0%, rgba(255,255,255,0.02) 34%, rgba(255,99,32,0.08) 100%)',
                            border: '1px solid rgba(255,190,120,0.16)',
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
                                borderRadius: '26px',
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
                        padding: '56px 40px',
                    }}
                >
                    <h3 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', lineHeight: 1.05, marginBottom: '18px' }}>
                        Own a piece of the universe. Today.
                    </h3>
                    <p style={{ maxWidth: '760px', margin: '0 auto 30px', color: '#b7b7be', lineHeight: 1.85, fontSize: '1.08rem' }}>
                        Whether it be a gift for a loved one or a personal investment - Aster Atlas is the registry for you.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <Link to="/buy" style={primaryButtonStyle}>
                            Register a Star
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
