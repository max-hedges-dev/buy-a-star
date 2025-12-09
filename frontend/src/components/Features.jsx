import React from 'react';
import { Download, Gift, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay }}
        style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            flex: 1,
            minWidth: '280px'
        }}
    >
        <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,77,0,0.2) 0%, rgba(255,77,0,0) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '10px'
        }}>
            <Icon size={40} color="#ff4d00" />
        </div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>{title}</h3>
        <p style={{ color: '#aaa', lineHeight: '1.6' }}>{description}</p>
    </motion.div>
);

const Features = () => {
    return (
        <section style={{ padding: '100px 40px', background: '#050505', position: 'relative', zIndex: 2 }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '80px' }}
                >
                    <h2 style={{ fontSize: '3rem', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>
                        A Gift Out Of This World
                    </h2>
                    <div style={{ width: '100px', height: '4px', background: 'var(--primary)', margin: '0 auto' }}></div>
                </motion.div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
                    <FeatureCard
                        icon={Download}
                        title="Instant Digital Download"
                        description="Receive your customized certificate properly instantly via email. High-resolution PDF ready to verify your ownership."
                        delay={0}
                    />
                    <FeatureCard
                        icon={Gift}
                        title="Premium Gift Pack"
                        description="Choose our printed option to receive a high-quality physical certificate, sky map, and information booklet in a luxury folder."
                        delay={0.2}
                    />
                    <FeatureCard
                        icon={ShieldCheck}
                        title="Unique Ownership"
                        description="Every star is unique and registered on the blockchain of our database. Once bought, it belongs solely to you forever."
                        delay={0.4}
                    />
                </div>

                {/* Certificate Preview Section */}
                <div style={{ marginTop: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        style={{
                            background: 'linear-gradient(45deg, #111, #0a0a0a)',
                            padding: '60px',
                            borderRadius: '10px',
                            border: '10px solid #222',
                            maxWidth: '800px',
                            width: '100%',
                            boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
                            position: 'relative'
                        }}
                    >
                        <div style={{ textAlign: 'center', border: '2px solid #333', padding: '40px' }}>
                            <h3 style={{ fontFamily: 'serif', fontSize: '3rem', color: '#fff', marginBottom: '20px' }}>Certificate of Registry</h3>
                            <p style={{ fontSize: '1.2rem', color: '#888', marginBottom: '40px' }}>This certifies that the star known as</p>
                            <h2 style={{ fontSize: '4rem', color: 'var(--primary)', fontFamily: 'serif', marginBottom: '40px' }}>Alpha Centauri</h2>
                            <p style={{ fontSize: '1.2rem', color: '#888' }}>is officially registered to</p>
                            <h3 style={{ fontSize: '2.5rem', color: '#fff', margin: '30px 0', fontFamily: 'serif', fontStyle: 'italic' }}>Your Name Here</h3>
                        </div>
                    </motion.div>
                    <div style={{ marginTop: '40px', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '2rem', marginBottom: '10px' }}>Official Certificate</h3>
                        <p style={{ color: '#aaa', fontSize: '1.2rem' }}>Available in digital and printed high-gloss formats.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Features;
