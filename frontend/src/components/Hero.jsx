import React, { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import DetailedStar from './DetailedStar';

const Hero = () => {
    const heroStar = useMemo(() => ({
        id: 'hero-orange-star',
        category: 'Orange Giant',
    }), []);
    const [showHeroScene] = useState(true);
    const [heroSceneVisible, setHeroSceneVisible] = useState(false);
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
    }));

    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);
    const parallaxX = useSpring(pointerX, { stiffness: 70, damping: 18, mass: 0.6 });
    const parallaxY = useSpring(pointerY, { stiffness: 70, damping: 18, mass: 0.6 });

    useEffect(() => {
        const handleResize = () => setViewportSize({
            width: window.innerWidth,
            height: window.innerHeight,
        });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const { width: viewportWidth, height: viewportHeight } = viewportSize;
    const isTablet = viewportWidth < 1100;
    const isMobile = viewportWidth < 760;
    const isShort = viewportHeight < 860;
    const widthDrivenStar = isMobile
        ? Math.min(320, viewportWidth * 0.76)
        : isTablet
            ? Math.min(400, viewportWidth * 0.44)
            : Math.min(518, viewportWidth * 0.34);
    const heightDrivenStar = isMobile
        ? viewportHeight * 0.34
        : isTablet
            ? viewportHeight * 0.38
            : viewportHeight * 0.46;
    const heroStarSize = Math.max(220, Math.min(widthDrivenStar, heightDrivenStar));
    const heroButtonMarginBottom = isMobile ? 112 : isTablet ? 120 : isShort ? 126 : 160;
    const heroTextTop = isMobile ? '41%' : isTablet ? '43%' : isShort ? '44%' : '48%';
    const heroGlowSize = isMobile ? '140vw' : isTablet ? '122vw' : '108vw';

    const handlePointerMove = (event) => {
        const { innerWidth, innerHeight } = window;
        const normalizedX = event.clientX / innerWidth - 0.5;
        const normalizedY = event.clientY / innerHeight - 0.5;

        pointerX.set(normalizedX * -56.16);
        pointerY.set(normalizedY * -42.12);
    };

    const handlePointerLeave = () => {
        pointerX.set(0);
        pointerY.set(0);
    };

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
        background: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 18%),
            radial-gradient(circle at 78% 70%, rgba(255,140,60,0.08) 0%, transparent 22%),
            linear-gradient(135deg, rgba(22,16,20,0.96) 0%, rgba(10,10,14,0.98) 55%, rgba(28,16,10,0.96) 100%)
        `,
        color: 'white',
        fontWeight: '700',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.95rem',
        backdropFilter: 'blur(14px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -14px 30px rgba(0,0,0,0.28), 0 14px 28px rgba(0,0,0,0.24)',
        position: 'relative',
        overflow: 'hidden',
    };

    return (
        <section
            onMouseMove={handlePointerMove}
            onMouseLeave={handlePointerLeave}
            style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden' }}
        >
            <motion.div
                style={{
                    position: 'absolute',
                    top: '-3%',
                    left: '-3%',
                    width: '106%',
                    height: '106%',
                    zIndex: 0,
                    x: parallaxX,
                    y: parallaxY,
                }}
            >
                <Canvas>
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                </Canvas>
            </motion.div>

            <div
                style={{
                    position: 'absolute',
                    zIndex: 1,
                    top: heroTextTop,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    width: '100%',
                    maxWidth: '920px',
                    padding: isMobile ? '0 20px' : '0 28px',
                }}
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    style={{
                        color: '#ff9c63',
                        fontSize: isMobile ? '0.74rem' : '0.86rem',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginBottom: '22px',
                    }}
                >
                    ASTER ATLAS CELESTIAL REGISTRY
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.7, delay: 0.08 }}
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
                        fontSize: isMobile ? '1rem' : isTablet ? '1.04rem' : '1.12rem',
                        color: '#b5b5bc',
                        lineHeight: isMobile ? '1.72' : '1.9',
                        maxWidth: '760px',
                        margin: '0 auto 34px',
                    }}
                >
                    Choose a real catalogued star, record it in the Aster Atlas registry, and receive a digital certificate issued straight after purchase. Each registered star and its owner can be found forever inside the galaxy.
                </motion.p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px', flexWrap: 'wrap', marginBottom: `${heroButtonMarginBottom}px` }}>
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
                    width: `${heroStarSize}px`,
                    height: `${heroStarSize}px`,
                    transform: 'translateX(-50%)',
                    zIndex: 0,
                    pointerEvents: 'none',
                    mixBlendMode: 'screen',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: `
                            radial-gradient(circle at 50% 50%, rgba(255,248,214,0.98) 0%, rgba(255,202,112,0.92) 12%, rgba(255,140,48,0.42) 28%, rgba(255,120,30,0.16) 44%, rgba(255,120,30,0) 68%)
                        `,
                        filter: 'blur(16px)',
                        opacity: heroSceneVisible ? 0 : 1,
                        transform: heroSceneVisible ? 'scale(1.08)' : 'scale(1)',
                        transition: 'opacity 0.45s ease, transform 0.6s ease',
                    }}
                />

                {showHeroScene ? (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            opacity: heroSceneVisible ? 1 : 0,
                            transition: 'opacity 0.55s ease',
                        }}
                    >
                        <Canvas
                            camera={{ position: [0, 0, 8], fov: 38 }}
                            dpr={[1, 1.5]}
                            gl={{ alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' }}
                            onCreated={({ gl }) => {
                                gl.setClearColor(0x000000, 0);
                                window.requestAnimationFrame(() => {
                                    setHeroSceneVisible(true);
                                });
                            }}
                            style={{ background: 'transparent' }}
                        >
                            <ambientLight intensity={0.2} />
                            <pointLight position={[8, 4, 8]} intensity={1.3} />
                            <pointLight position={[-6, -3, -6]} intensity={0.35} />
                            <DetailedStar star={heroStar} detailLevel="hero" />
                        </Canvas>
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: '-88%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: heroGlowSize,
                    height: heroGlowSize,
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
