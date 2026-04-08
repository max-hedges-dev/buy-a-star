import React from 'react';

const sectionStyle = {
    background: 'linear-gradient(180deg, rgba(17,17,17,0.9) 0%, rgba(9,9,9,0.96) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '28px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.32)',
};

const LegalDocument = ({ title, intro, sections }) => {
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
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ width: '72px', height: '1px', margin: '10px auto 38px', background: 'rgba(255,255,255,0.78)', boxShadow: '0 0 14px rgba(255,255,255,0.12)' }} />

                <div style={{ textAlign: 'center', marginBottom: '44px' }}>
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
                        Legal
                    </div>
                    <h1 style={{ fontSize: 'clamp(2.5rem, 4.8vw, 4.6rem)', lineHeight: 1.02, marginBottom: '18px' }}>
                        {title}
                    </h1>
                    <p style={{ maxWidth: '760px', margin: '0 auto', color: '#b7b7be', lineHeight: 1.85, fontSize: '1.08rem' }}>
                        {intro}
                    </p>
                </div>

                <div style={{ ...sectionStyle, padding: '34px 32px', display: 'grid', gap: '28px' }}>
                    {sections.map((section) => (
                        <div key={section.heading}>
                            <h2 style={{ fontSize: '1.28rem', marginBottom: '12px', color: 'white' }}>{section.heading}</h2>
                            {section.intro ? (
                                <p style={{ color: '#d8d8dd', lineHeight: 1.8, marginBottom: section.bullets ? '14px' : 0 }}>
                                    {section.intro}
                                </p>
                            ) : null}
                            {section.paragraphs?.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    style={{
                                        color: '#d8d8dd',
                                        lineHeight: 1.85,
                                        marginBottom: '12px',
                                    }}
                                >
                                    {paragraph}
                                </p>
                            ))}
                            {section.bullets ? (
                                <ul style={{ color: '#d8d8dd', lineHeight: 1.85, paddingLeft: '22px', display: 'grid', gap: '8px' }}>
                                    {section.bullets.map((bullet) => (
                                        <li key={bullet}>{bullet}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {section.outro ? (
                                <p style={{ color: '#d8d8dd', lineHeight: 1.85, marginTop: '14px' }}>
                                    {section.outro}
                                </p>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default LegalDocument;
