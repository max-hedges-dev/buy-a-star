import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { fetchStars } from '../services/api';
import { Search, ShoppingCart, Loader2 } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import CheckoutModal from '../components/CheckoutModal';
import UniverseMap from '../components/UniverseMap';
import StarViewer from '../components/StarViewer';
import GalaxyBackground from '../components/GalaxyBackground';
import * as THREE from 'three';

const VIEW_MODE = {
    MAP: 'MAP',
    TRANSITION: 'TRANSITION',
    DISPLAY: 'DISPLAY'
};

// --- IDLE CONTROLLER COMPONENT ---
// Handles the 10s timer, auto-reset, and spinning logic
const IdleController = ({ controlsRef, isHoveringStar, viewMode, targetStar }) => {
    const { camera } = useThree();
    const lastInteraction = useRef(Date.now());
    const isIdle = useRef(true); // Start idle so it spins initially

    // Reset timer on user interaction
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        const onStart = () => {
            isIdle.current = false;
            controls.autoRotate = false;
        };

        const onEnd = () => {
            lastInteraction.current = Date.now();
        };

        controls.addEventListener('start', onStart);
        controls.addEventListener('end', onEnd);
        return () => {
            controls.removeEventListener('start', onStart);
            controls.removeEventListener('end', onEnd);
        };
    }, [controlsRef]);

    useFrame((state, delta) => {
        if (viewMode !== VIEW_MODE.MAP) return;

        // If hovering a star, reset timer and pause idle
        if (isHoveringStar) {
            lastInteraction.current = Date.now();
            if (controlsRef.current) controlsRef.current.autoRotate = false;
            return;
        }

        const timeSinceInteraction = Date.now() - lastInteraction.current;

        // Check for Idle Trigger (10s)
        if (!isIdle.current && timeSinceInteraction > 10000) {
            isIdle.current = true;
        }

        // Behavior when Idle
        if (isIdle.current) {
            const controls = controlsRef.current;
            if (!controls) return;

            // 1. Enable Spin
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5; // Slow spin

            // 2. Smoothly return to MAX zoom/position using Spherical coordinates
            // Target: Radius 2500 (Max Zoom), Phi ~72 deg (Cinematic Angle)

            const targetRadius = 2500;
            const targetPhi = Math.PI / 2.5; // ~72 degrees

            // Get current spherical coordinates
            const spherical = new THREE.Spherical().setFromVector3(camera.position);

            // Smoothly interpolate Radius and Phi
            // We verify distance to avoid unnecessary calculations when "arrived"
            if (Math.abs(spherical.radius - targetRadius) > 5 || Math.abs(spherical.phi - targetPhi) > 0.01) {
                spherical.radius = THREE.MathUtils.lerp(spherical.radius, targetRadius, 0.05); // Faster visual snap
                spherical.phi = THREE.MathUtils.lerp(spherical.phi, targetPhi, 0.05);

                // IMPORTANT: We do NOT touch spherical.theta, letting autoRotate handle it

                // Apply back to camera
                camera.position.setFromSpherical(spherical);
            }
        }
    });

    return null;
};

const SearchPage = () => {
    // Data State
    const [stars, setStars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // View State
    const [viewMode, setViewMode] = useState(VIEW_MODE.MAP);
    const [selectedStar, setSelectedStar] = useState(null); // The star currently in focus/display
    const [targetStar, setTargetStar] = useState(null);     // The star map is zooming towards

    // UI State
    const [searchTerm, setSearchTerm] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [buyingStar, setBuyingStar] = useState(null); // Modal trigger

    // Idle State
    const [isHoveringStar, setIsHoveringStar] = useState(false);
    const controlsRef = useRef();

    useEffect(() => {
        loadStars();
    }, []);

    const loadStars = async (term = "") => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchStars({ search: term, limit: 1000 });
            setStars(data);
        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Search Logic ---
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length > 1) {
            const matches = stars.filter(s =>
                (s.common_name && s.common_name.toLowerCase().includes(value.toLowerCase())) ||
                s.scientific_name.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 5);
            setSuggestions(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (suggestions.length > 0) {
            triggerTransitionToStar(suggestions[0]);
        } else {
            // Just reload map? Or find first match?
            const match = stars.find(s =>
                (s.common_name && s.common_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                s.scientific_name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (match) triggerTransitionToStar(match);
        }
        setShowSuggestions(false);
    };

    // --- Transition Logic ---
    const triggerTransitionToStar = (star) => {
        if (viewMode !== VIEW_MODE.MAP) return;

        setSelectedStar(star);
        setTargetStar(star); // Tells UniverseMap to zoom camera towards this point

        // Stop idle spin immediately on selection
        if (controlsRef.current) controlsRef.current.autoRotate = false;

        // 1. Zoom starts via UniverseMap (useEffect on targetStar) OR we animate here?
        // Let's let UniverseMap handle the 'glimpse' zoom for 1.5s, then blur.

        // Wait for zoom to happen partially
        setTimeout(() => {
            setViewMode(VIEW_MODE.TRANSITION);

            // Wait for blur fade-in
            setTimeout(() => {
                setViewMode(VIEW_MODE.DISPLAY);
                setTargetStar(null); // Stop map zoom
            }, 1000); // 1s blur in

        }, 1200); // 1.2s zoom time before blur covers it
    };

    const handleBackToMap = () => {
        setViewMode(VIEW_MODE.TRANSITION);

        setTimeout(() => {
            setViewMode(VIEW_MODE.MAP);
            setSelectedStar(null);
        }, 1000);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: 'black', overflow: 'hidden', position: 'relative' }}>
            <Navbar />

            {/* --- MAP LAYER --- */}
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 1,
                // Hide Map if showing Display OR if Transitioning BACK to Map (blurring display)
                visibility: (viewMode === VIEW_MODE.DISPLAY || (viewMode === VIEW_MODE.TRANSITION && !targetStar)) ? 'hidden' : 'visible'
            }}>
                {/* 
                    Far plane set to 100000 to prevent stars popping out 
                    Camera position set to allow good initial view of galaxy
                    Default Position: [0, 800, 2400] approx max zoom (radius ~2500)
                */}
                <Canvas camera={{ position: [0, 800, 2400], fov: 60, far: 100000 }}>
                    <color attach="background" args={['#050505']} />
                    <ambientLight intensity={0.5} />

                    <IdleController
                        controlsRef={controlsRef}
                        isHoveringStar={isHoveringStar}
                        viewMode={viewMode}
                        targetStar={targetStar}
                    />

                    {/* Nebula Background - Visual Only */}
                    <GalaxyBackground count={400} />

                    {!loading && stars.length > 0 && (
                        <UniverseMap
                            stars={stars}
                            viewMode={viewMode}
                            onSelectStar={triggerTransitionToStar}
                            targetStar={targetStar}
                            onHoverChange={setIsHoveringStar}
                        />
                    )}

                    <OrbitControls
                        ref={controlsRef}
                        enablePan={true}
                        enableZoom={true}
                        enableRotate={true}
                        minDistance={5}
                        maxDistance={2500} // Limited zoom out as requested
                        enabled={viewMode === VIEW_MODE.MAP} // Disable controls during transition
                    />
                </Canvas>

                {/* Search UI (Only on Map) */}
                <div style={{
                    position: 'absolute', zIndex: 10, top: 100, left: 40, width: '400px',
                    opacity: viewMode === VIEW_MODE.MAP ? 1 : 0, transition: 'opacity 0.5s',
                    pointerEvents: viewMode === VIEW_MODE.MAP ? 'auto' : 'none'
                }}>
                    <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <input
                            type="text"
                            placeholder="Search Milky Way..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            onFocus={() => { if (searchTerm.length > 1) setShowSuggestions(true); }}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(0,0,0,0.8)', color: 'white'
                            }}
                        />
                        <button type="submit" style={{ padding: '0 20px', background: 'var(--primary)', borderRadius: '8px' }}>
                            <Search color="white" />
                        </button>
                    </form>

                    {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '50px', left: 0, right: 0,
                            background: 'rgba(20,20,20,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            {suggestions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => triggerTransitionToStar(s)}
                                    style={{ padding: '10px', cursor: 'pointer', color: '#eee', borderBottom: '1px solid #333' }}
                                    onMouseEnter={e => e.target.style.background = '#333'}
                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                >
                                    {s.common_name || s.scientific_name}
                                </div>
                            ))}
                        </div>
                    )}

                    {!selectedStar && (
                        <div style={{ color: '#888', marginTop: '10px' }}>
                            Drag to Rotate • Scroll to Zoom • Click to Explore
                        </div>
                    )}
                </div>
            </div>

            {/* --- DISPLAY LAYER --- */}
            {selectedStar && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    zIndex: 200,
                    // Show Display if DISPLAY mode OR if Transitioning BACK (blurring display)
                    opacity: (viewMode === VIEW_MODE.DISPLAY || (viewMode === VIEW_MODE.TRANSITION && !targetStar)) ? 1 : 0,
                    pointerEvents: viewMode === VIEW_MODE.DISPLAY ? 'auto' : 'none',
                    transition: 'opacity 0.2s ease-in'
                }}>
                    <StarViewer
                        star={selectedStar}
                        onBack={handleBackToMap}
                        onBuy={() => setBuyingStar(selectedStar)}
                    />
                </div>
            )}

            {/* --- TRANSITION BLUR OVERLAY --- */}
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 100,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(50px)',
                opacity: viewMode === VIEW_MODE.TRANSITION ? 1 : 0,
                pointerEvents: 'none',
                transition: 'opacity 1s ease-in-out'
            }} />

            {/* Modals & Loading */}
            {error && <div style={{ position: 'absolute', bottom: 20, left: 20, color: 'red', zIndex: 200 }}>{error}</div>}
            {loading && <div style={{ position: 'absolute', bottom: 20, left: 20, color: 'white', zIndex: 200 }}>Loading...</div>}

            {buyingStar && (
                <CheckoutModal
                    star={buyingStar}
                    onClose={() => setBuyingStar(null)}
                    onSuccess={() => { loadStars(); setBuyingStar(null); alert("Star Purchased!"); }}
                />
            )}
        </div>
    );
};

export default SearchPage;
