import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DetailedStar from './DetailedStar';

const Hero = () => {
    const heroStar = useMemo(() => ({
        id: 'hero-orange-star',
        category: 'Orange Giant',
    }), []);

    const primaryButtonStyle = {
        padding: '16px 34px',
        background: 'linear-gradient(45deg, #ff4d00, #ff8800)',
        color: 'white',
        fontWeight: '700',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        boxShadow: '0 0 24px rgba(255, 77, 0, 0.35)',
        border: '1px solid rgba(255,255,255,0.18)',
        fontSize: '0.95rem',
    };

    const secondaryButtonStyle = {
        padding: '16px 34px',
        background: 'rgba(255,255,255,0.04)',
        color: 'white',
        fontWeight: '700',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.14)',
        fontSize: '0.95rem',
        backdropFilter: 'blur(14px)',
    };

    return (
        <section style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
                <Canvas>
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                </Canvas>
            </div>

            <div
                style={{
                    position: 'absolute',
                    zIndex: 1,
                    top: '48%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    width: '100%',
                    maxWidth: '920px',
                    padding: '0 28px',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    style={{
                        color: '#ff9c63',
                        fontSize: '0.86rem',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginBottom: '22px',
                    }}
                >
                    ASTER ATLAS CELESTIAL REGISTRY
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    style={{
                        fontSize: 'clamp(3rem, 6vw, 5.25rem)',
                        fontWeight: '800',
                        lineHeight: 0.98,
                        marginBottom: '24px',
                        color: '#ffffff',
                    }}
                >
                    Own a real star. Forever.
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.8 }}
                    style={{
                        fontSize: '1.12rem',
                        color: '#b5b5bc',
                        lineHeight: '1.9',
                        maxWidth: '760px',
                        margin: '0 auto 34px',
                    }}
                >
                    Choose a real catalogued star, record it in the Aster Atlas registry, and receive a digital certificate issued straight after purchase. Each registered star and its owner can be found forever inside the galaxy.
                </motion.p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px', flexWrap: 'wrap', marginBottom: '160px'}}>
                    <Link to="/buy" style={primaryButtonStyle}>
                        Register a Star
                    </Link>
                    <Link to="/search" style={secondaryButtonStyle}>
                        Explore the Galaxy
                    </Link>
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: '-3vh',
                    width: '518px',
                    height: '518px',
                    transform: 'translateX(-50%)',
                    zIndex: 1,
                    pointerEvents: 'none',
                    mixBlendMode: 'screen',
                }}
            >
                <Canvas
                    camera={{ position: [0, 0, 8], fov: 38 }}
                    gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
                    onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
                    style={{ background: 'transparent' }}
                >
                    <ambientLight intensity={0.2} />
                    <pointLight position={[8, 4, 8]} intensity={1.3} />
                    <pointLight position={[-6, -3, -6]} intensity={0.35} />
                    <DetailedStar star={heroStar} detailLevel="hero" />
                </Canvas>
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: '-88%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '108vw',
                    height: '108vw',
                    background: 'radial-gradient(circle, #ff4d00 0%, transparent 60%)',
                    opacity: 0.2,
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />
        </section>
    );
};

export default Hero;
