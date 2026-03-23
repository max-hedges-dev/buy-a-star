import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DetailedStar from './DetailedStar';

const RotatingStars = () => {
    const ref = useRef()
    useFrame((state, delta) => {
        ref.current.rotation.x -= delta / 10
        ref.current.rotation.y -= delta / 15
    })
    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={new Float32Array(5000 * 3)} stride={3} frustumCulled={false}>
                <pointsMaterial transparent color="#ffa0e0" size={0.005} sizeAttenuation={true} depthWrite={false} />
            </Points>
        </group>
    )
}

function Points({ ...props }) {
    const ref = useRef()
    // Generate random points on a sphere
    const positions = new Float32Array(3000)
    for (let i = 0; i < 3000; i++) {
        positions[i] = (Math.random() - 0.5) * 10
    }

    return (
        <points ref={ref} {...props}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={1000} array={positions} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.015} color="white" transparent opacity={0.8} />
        </points>
    )
}


const Hero = () => {
    const heroStar = useMemo(() => ({
        id: 'hero-orange-star',
        category: 'Orange Giant',
    }), []);

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden' }}>

            {/* Background Starfield */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
                <Canvas>
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                </Canvas>
            </div>

            {/* Central Content */}
            <div style={{
                position: 'absolute',
                zIndex: 1,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                width: '100%'
            }}>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    style={{
                        fontSize: '4rem',
                        fontWeight: '800',
                        letterSpacing: '5px',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                        color: '#ffffff'
                    }}
                >
                    Aster Atlas
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    style={{
                        fontSize: '1.2rem',
                        letterSpacing: '3px',
                        color: '#aaa',
                        marginBottom: '50px',
                        textTransform: 'uppercase'
                    }}
                >
                    A celestial registry and galaxy explorer
                </motion.p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '40px' }}>
                    <Link to="/search" style={{
                        padding: '15px 40px',
                        background: 'linear-gradient(45deg, #ff4d00, #ff8800)',
                        color: 'white',
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                        textTransform: 'uppercase',
                        borderRadius: '30px',
                        boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)',
                        transition: 'transform 0.2s',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        BUY or FIND A STAR
                    </Link>
                </div>
            </div>

            <div style={{
                position: 'absolute',
                left: '50%',
                bottom: '-3vh',
                width: '518px',
                height: '518px',
                transform: 'translateX(-50%)',
                zIndex: 1,
                pointerEvents: 'none',
                mixBlendMode: 'screen',
            }}>
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

            {/* Bottom Planet/Glow effect (CSS visual) */}
            <div style={{
                position: 'absolute',
                bottom: '-88%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '108vw',
                height: '108vw',
                background: 'radial-gradient(circle, #ff4d00 0%, transparent 60%)',
                opacity: 0.2,
                zIndex: 0,
                pointerEvents: 'none'
            }}></div>

        </div>
    );
};

export default Hero;
