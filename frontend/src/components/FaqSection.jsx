import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

const FAQ_ITEMS = [
    {
        question: 'What do I receive when I register a star?',
        answer:
            'You receive a digital certificate and a recorded entry in the Aster Atlas registry for a real catalogued star. The registration includes the chosen name or dedication together with the star’s catalog reference and star details.',
    },
    {
        question: 'Is the certificate digital or physical?',
        answer:
            'The certificate is currently digital and is issued immediately after purchase.',
    },
    {
        question: 'Can the recipient find their star again?',
        answer:
            'Yes. Each registered star has its own record and can be found again through the atlas and its star page.',
    },
    {
        question: 'Is the star real?',
        answer:
            'Yes. Every registration is tied to a real catalogued star selected from astronomical data.',
    },
    {
        question: 'Am I officially naming a star?',
        answer:
            'No. Aster Atlas is a private celestial registry, not a scientific naming authority. The star keeps its scientific catalog designation, and the registration creates a personal record for that star within Aster Atlas.',
    },
    {
        question: 'Can two people register the same star?',
        answer:
            'No. Each star can only have one active registration within Aster Atlas. Once registered, it is no longer available for a new registration.',
    },
    {
        question: 'Why choose Aster Atlas instead of a simpler star registry?',
        answer:
            'Because Aster Atlas is built as a proper registry. Each entry is tied to a real catalogued star, recorded clearly, issued with a certificate, and kept accessible through the atlas.',
    },
    {
        question: 'Do I need to understand astronomy to buy one?',
        answer:
            'No. The process is straightforward. The catalog data is there to identify the star clearly, but no specialist knowledge is needed to register one.',
    },
    {
        question: 'Can I buy now and come back to the star later?',
        answer:
            'Yes. Once registered, the star remains part of the Aster Atlas registry and can be revisited later through its record in the atlas.',
    },
];

const FaqItem = ({ item, isOpen, onToggle, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, delay }}
        style={{
            background: 'linear-gradient(180deg, rgba(17,17,17,0.94) 0%, rgba(9,9,9,1) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
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
                color: 'white',
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
                    color: '#ff7a1f',
                    flexShrink: 0,
                }}
            />
        </button>
        {isOpen && (
            <div style={{ padding: '0 26px 24px', color: '#b7b7be', lineHeight: 1.8, fontSize: '1rem' }}>
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
                    radial-gradient(circle at 80% 10%, rgba(255,95,24,0.08), transparent 24%),
                    linear-gradient(180deg, #050505 0%, #070707 100%)
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
                    <div style={{ color: '#ff9150', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.82rem', marginBottom: '18px' }}>
                        FREQUENTLY ASKED QUESTIONS
                    </div>
                    <h2 style={{ fontSize: 'clamp(2.5rem, 4.8vw, 4rem)', lineHeight: 1.05, marginBottom: '18px' }}>
                        Clear answers before you register
                    </h2>
                    <p style={{ maxWidth: '760px', margin: '0 auto', color: '#b7b7be', lineHeight: 1.85, fontSize: '1.08rem' }}>
                        These are the questions people usually ask before they buy. The answers below explain exactly what the registration is and how the registry works.
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
