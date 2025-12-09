import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Text, Float, Trail, Sparkles } from '@react-three/drei';
import DetailedStar from './DetailedStar';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import * as THREE from 'three';

const StarViewer = ({ star, onBack, onBuy }) => {
    // Static Display View
    // Camera is fixed? Or slowly orbiting?
    // User said: "interact with display view - it should be static"

    // We can add a very slow idle rotation to the star itself so it's not dead.

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* 3D Scene */}
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                <color attach="background" args={['#000000']} />
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 5, 10]} intensity={1.5} />
                <pointLight position={[-10, -5, -10]} intensity={0.5} />

                {/* Background Dust/Stars */}
                <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />

                {/* The Star */}
                <group position={[0, 0, 0]}>
                    <DetailedStar star={star} />
                </group>

            </Canvas>

            {/* UI Overlay for Display Mode */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none', // Allow clicking mostly? No, static view.
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '40px'
            }}>
                {/* Top Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', pointerEvents: 'auto' }}>
                    <button
                        onClick={onBack}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white', padding: '10px 20px', borderRadius: '30px',
                            cursor: 'pointer', backpackFilter: 'blur(10px)'
                        }}
                    >
                        <ArrowLeft size={20} /> Back to Map
                    </button>

                    <div style={{
                        background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '30px',
                        border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontSize: '0.9rem'
                    }}>
                        DISPLAY MODE
                    </div>
                </div>

                {/* Bottom Info & Buy */}
                <div style={{
                    alignSelf: 'center', textAlign: 'center',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
                    width: '100%', paddingBottom: '40px', paddingTop: '100px',
                    pointerEvents: 'auto'
                }}>
                    <h1 style={{ fontSize: '3.5rem', marginBottom: '10px', fontFamily: 'serif' }}>
                        {star.common_name || star.scientific_name}
                    </h1>
                    <p style={{ fontSize: '1.2rem', color: '#ccc', marginBottom: '30px' }}>
                        {star.category} • {star.distance_ly} ly • {star.x.toFixed(0)}, {star.y.toFixed(0)}, {star.z.toFixed(0)}
                    </p>

                    {!star.is_bought ? (
                        <button
                            onClick={onBuy}
                            style={{
                                background: 'var(--primary)', color: 'white',
                                border: 'none', padding: '15px 40px', borderRadius: '50px',
                                fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '1px',
                                cursor: 'pointer', boxShadow: '0 0 20px rgba(255,77,0,0.4)',
                                display: 'inline-flex', alignItems: 'center', gap: '10px'
                            }}
                        >
                            <ShoppingCart /> CLAIM THIS STAR (£{star.price})
                        </button>
                    ) : (
                        <div style={{
                            display: 'inline-block', padding: '15px 40px',
                            border: '1px solid #333', borderRadius: '50px', color: '#666'
                        }}>
                            UNAVAILABLE (SOLD)
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StarViewer;
