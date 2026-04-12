import React, { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import DetailedStar from './DetailedStar';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
    const widthScale = viewportWidth / 1440;
    const heightScale = viewportHeight / 920;
    const heroScale = clamp(Math.min(widthScale, heightScale), 0.42, 1.08);
    const smallWidthThreshold = 0.76;
    const widthDrivenStarScale = widthScale < smallWidthThreshold
        ? widthScale + ((smallWidthThreshold - widthScale) * 0.4)
        : widthScale;
    const heroStarScale = clamp(Math.min(widthDrivenStarScale, heightScale), 0.42, 1.08);
    const isTablet = viewportWidth < 1100;
    const isMobile = viewportWidth < 760;
    const heroStarSize = clamp(520 * heroStarScale, 180, 562);
    const heroStarBottomOffset = -heroStarSize * clamp(0.28 + (1 - heroStarScale) * 0.38, 0.28, 0.54);
    const heroButtonMarginBottom = clamp(132 * heroScale, 58, 150);
    const heroTextTop = `${clamp(48 - (1 - heroScale) * 13, 36, 48)}%`;
    const heroGlowScale = clamp(1 + (heroStarScale - 1) * 0.18, 0.9, 1.04);
    const heroGlowSize = `${clamp(108 * heroGlowScale, 96, 116)}vw`;
    const heroCoronaSize = clamp(780 * heroGlowScale, 620, 820);
    const heroCoronaBottomOffset = heroStarBottomOffset + (heroStarSize / 2) - (heroCoronaSize / 2);
    const heroCoronaBlur = Math.round(clamp(34 * heroGlowScale, 30, 36));
    const heroTitleScale = clamp(0.74 + heroScale * 0.26, 0.82, 1.08);
    const heroTitleSize = `clamp(${(2.9 * heroTitleScale).toFixed(2)}rem, ${(6.1 * heroTitleScale).toFixed(2)}vw, ${(5.25 * heroTitleScale).toFixed(2)}rem)`;
    const heroCopySize = `${clamp(1.12 * heroScale, 0.9, 1.12).toFixed(3)}rem`;
    const heroEyebrowSize = `${clamp(0.86 * heroScale, 0.66, 0.86).toFixed(3)}rem`;
    const heroButtonPadding = `${Math.round(clamp(16 * heroScale, 12, 16))}px ${Math.round(clamp(34 * heroScale, 22, 34))}px`;
    const heroButtonFontSize = `${clamp(0.95 * heroScale, 0.74, 0.95).toFixed(3)}rem`;

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
        padding: heroButtonPadding,
        background: 'linear-gradient(45deg, #ff4d00, #ff8800)',
        color: 'white',
        fontWeight: '700',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        boxShadow: '0 0 24px rgba(255, 77, 0, 0.35)',
        border: '1px solid rgba(255,255,255,0.18)',
        fontSize: heroButtonFontSize,
    };

    const secondaryButtonStyle = {
        padding: heroButtonPadding,
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
        fontSize: heroButtonFontSize,
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
                        fontSize: heroEyebrowSize,
                        letterSpacing: `${clamp(0.22 * heroScale, 0.14, 0.22)}em`,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginBottom: `${Math.round(clamp(22 * heroScale, 14, 22))}px`,
                    }}
                >
                    ASTER ATLAS CELESTIAL REGISTRY
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.7, delay: 0.08 }}
                    style={{
                        fontSize: heroTitleSize,
                        fontWeight: '800',
                        lineHeight: 0.98,
                        marginBottom: `${Math.round(clamp(24 * heroScale, 16, 24))}px`,
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
                        fontSize: heroCopySize,
                        color: '#b5b5bc',
                        lineHeight: isMobile ? '1.64' : isTablet ? '1.74' : '1.9',
                        maxWidth: '760px',
                        margin: `0 auto ${Math.round(clamp(34 * heroScale, 18, 34))}px`,
                    }}
                >
                    Choose a real catalogued star, record it in the Aster Atlas registry, and receive a digital certificate issued straight after purchase. Each registered star and its owner can be found forever inside the galaxy.
                </motion.p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: `${Math.round(clamp(16 * heroScale, 10, 16))}px`, marginTop: `${Math.round(clamp(20 * heroScale, 10, 20))}px`, flexWrap: 'wrap', marginBottom: `${heroButtonMarginBottom}px`, position: 'relative', zIndex: 3 }}>
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
                    bottom: `${heroCoronaBottomOffset}px`,
                    width: `${heroCoronaSize}px`,
                    height: `${heroCoronaSize}px`,
                    transform: 'translateX(-50%)',
                    zIndex: 0,
                    pointerEvents: 'none',
                    mixBlendMode: 'screen',
                    borderRadius: '50%',
                    background: `
                        radial-gradient(circle at 50% 50%, rgba(255,248,214,0.62) 0%, rgba(255,202,112,0.48) 13%, rgba(255,132,34,0.26) 31%, rgba(255,89,18,0.11) 50%, rgba(255,89,18,0) 72%)
                    `,
                    filter: `blur(${heroCoronaBlur}px)`,
                    opacity: 0.74,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: `${heroStarBottomOffset}px`,
                    width: `${heroStarSize}px`,
                    height: `${heroStarSize}px`,
                    transform: 'translateX(-50%)',
                    zIndex: 0,
                    pointerEvents: 'none',
                    mixBlendMode: 'screen',
                }}
            >
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
