import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

const FAQ_ITEMS = [
    {
        question: 'What do I receive when I register a star?',
        answer:
            'You receive a digital certificate and a private Aster Atlas registry record for a real catalogued star. The record includes the selected name or dedication, the star’s catalogue reference, and key star details.',
    },
    {
        question: 'Is the certificate digital or physical?',
        answer:
            'At launch, certificates are delivered digitally after registration. Physical certificates are planned for a future phase.',
    },
    {
        question: 'Can the recipient find their star again?',
        answer:
            'Yes. A registered star can be searched, opened, and revisited through Aster Atlas. The goal is for the star to remain findable after the certificate has been received.',
    },
    {
        question: 'Is the star real?',
        answer:
            'Yes. Stars in Aster Atlas are based on actual astronomical catalogue records. Aster Atlas adds a private registry layer and presentation experience on top of those records.',
    },
    {
        question: 'Am I officially naming a star?',
        answer:
            'No. Aster Atlas is a private registry and does not claim to replace scientific designations or official astronomical naming systems. The registered name or dedication exists inside Aster Atlas.',
    },
    {
        question: 'Can two people register the same star?',
        answer:
            'No. Within Aster Atlas, each star can only be registered once. Once a star has been registered, it should appear as unavailable to new buyers.',
    },
    {
        question: 'Why choose Aster Atlas instead of a simpler star registry?',
        answer:
            'Aster Atlas is designed to be more than a certificate. It combines real catalogue data, a searchable atlas, a lasting private record, and a visual place where the registered star can be found again.',
    },
    {
        question: 'Do I need to understand astronomy to buy one?',
        answer:
            'No. You can browse simply, choose a star visually, or use the information on each star page to understand why a particular star may feel right.',
    },
    {
        question: 'Can I buy now and come back to the star later?',
        answer:
            'Yes. Aster Atlas is built around persistent records, so registered stars can be returned to through your account and the atlas.',
    },
];

const FaqItem = ({ item, isOpen, onToggle, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, delay }}
        style={{
            background: 'linear-gradient(180deg, rgba(23,26,33,0.94) 0%, rgba(16,18,23,1) 100%)',
            border: '1px solid rgba(245,239,226,0.08)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 16px 50px rgba(0,0,0,0.22)',
        }}
    >
        <button
            onClick={onToggle}
            style={{
                width: '100%',
                background: 'transparent',
                color: 'var(--text-color)',
                padding: '24px 26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                fontSize: '1.08rem',
                fontWeight: 600,
            }}
        >
            <span style={{ maxWidth: '90%' }}>{item.question}</span>
            <ChevronDown
                size={22}
                style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s ease',
                    color: 'var(--primary-strong)',
                    flexShrink: 0,
                }}
            />
        </button>
        {isOpen && (
            <div style={{ padding: '0 26px 24px', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1rem' }}>
                {item.answer}
            </div>
        )}
    </motion.div>
);

const FaqSection = () => {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section
            id="faq"
            style={{
                padding: '120px 40px',
                background: `
                    radial-gradient(circle at 80% 10%, rgba(200,121,58,0.08), transparent 24%),
                    radial-gradient(circle at 22% 12%, rgba(216,168,95,0.08), transparent 20%),
                    linear-gradient(180deg, #020305 0%, #070a11 100%)
                `,
                position: 'relative',
                zIndex: 2,
            }}
        >
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.7 }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <div style={{ color: 'var(--primary-strong)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.78rem', marginBottom: '18px' }}>
                        FREQUENTLY ASKED QUESTIONS
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(2.8rem, 4.8vw, 4.2rem)', lineHeight: 0.98, letterSpacing: '-0.02em', marginBottom: '18px' }}>
                        Clear answers before you register.
                    </h2>
                    <p style={{ maxWidth: '760px', margin: '0 auto', color: 'var(--text-secondary)', lineHeight: 1.85, fontSize: '1.08rem' }}>
                        These are the questions people usually ask before choosing a star. The answers below explain what the registration is, what the certificate includes, and how Aster Atlas records work.
                    </p>
                </motion.div>

                <div style={{ display: 'grid', gap: '16px' }}>
                    {FAQ_ITEMS.map((item, index) => (
                        <FaqItem
                            key={item.question}
                            item={item}
                            isOpen={openIndex === index}
                            onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
                            delay={index * 0.05}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FaqSection;
