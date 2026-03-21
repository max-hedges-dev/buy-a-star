import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Default camera position and constants
const DEFAULT_CAM_POS = new THREE.Vector3(0, 800, 2400);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const MIN_DIST = 5;
const MAX_DIST = 4200;
const IDLE_TIMEOUT = 10000; // 10 seconds

const VIEW_MODE = {
    MAP: 'MAP',
    TRANSITION: 'TRANSITION',
    DISPLAY: 'DISPLAY'
};

// --- IDLE CONTROLLER ---
// When idle: slowly spins galaxy, returns camera AND galaxy position to default
const IdleController = ({ galaxyRef, lastInteractionRef, isHoveringStar, viewMode }) => {
    const { camera } = useThree();
    const isIdle = useRef(true);

    // Store default quaternion once
    const defaultQuat = React.useMemo(() => {
        const cam = new THREE.PerspectiveCamera();
        cam.position.copy(DEFAULT_CAM_POS);
        cam.lookAt(DEFAULT_TARGET);
        return cam.quaternion.clone();
    }, []);

    useFrame((state, delta) => {
        if (viewMode !== VIEW_MODE.MAP) return;
        if (!galaxyRef.current) return;

        if (isHoveringStar) {
            lastInteractionRef.current = Date.now();
            isIdle.current = false;
            return;
        }

        const timeSince = Date.now() - lastInteractionRef.current;
        isIdle.current = timeSince > IDLE_TIMEOUT;

        if (isIdle.current) {
            // 1. Slowly spin galaxy
            galaxyRef.current.rotation.y += delta * 0.08;

            // 2. Lerp tilt (rotation.x) back to 0
            galaxyRef.current.rotation.x *= 0.97;

            // 3. Lerp galaxy position back to origin (undo drags)
            galaxyRef.current.position.lerp(DEFAULT_TARGET, 0.03);

            // 3. Return camera to default position and angle
            camera.position.lerp(DEFAULT_CAM_POS, 0.02);
            camera.quaternion.slerp(defaultQuat, 0.02);
        }
    });

    return null;
};

// --- GALAXY DRAGGER ---
// Left-click drag: horizontal = spin (Y rotation), vertical = tilt (X rotation)
const GalaxyDragger = ({ galaxyRef, lastInteractionRef, viewMode }) => {
    const { gl } = useThree();

    useEffect(() => {
        if (viewMode !== VIEW_MODE.MAP) return;
        const canvas = gl.domElement;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        const onDown = (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            lastInteractionRef.current = Date.now();
            canvas.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!isDragging || !galaxyRef.current) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            // Horizontal drag = spin around Y
            galaxyRef.current.rotation.y += dx * 0.004;

            // Vertical drag = tilt around X (clamped to ±60°)
            const newTilt = galaxyRef.current.rotation.x + dy * 0.003;
            galaxyRef.current.rotation.x = THREE.MathUtils.clamp(newTilt, -Math.PI / 3, Math.PI / 3);

            lastX = e.clientX;
            lastY = e.clientY;
            lastInteractionRef.current = Date.now();
        };

        const onUp = () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        };

        canvas.style.cursor = 'grab';
        canvas.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            canvas.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            canvas.style.cursor = '';
        };
    }, [gl, galaxyRef, viewMode, lastInteractionRef]);

    return null;
};

// --- ZOOM TO POINTER ---
// Zoom-in: dolly camera toward cursor's 3D point (no forced lookAt — view shifts naturally)
// Zoom-out: lerp camera back to default pos/angle AND galaxy group back to origin
const ZoomToPointer = ({ galaxyRef, lastInteractionRef, viewMode }) => {
    const { camera, gl, raycaster, pointer } = useThree();
    const galaxyPlane = React.useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

    // Store default quaternion
    const defaultQuat = React.useMemo(() => {
        const cam = new THREE.PerspectiveCamera();
        cam.position.copy(DEFAULT_CAM_POS);
        cam.lookAt(DEFAULT_TARGET);
        return cam.quaternion.clone();
    }, []);

    useEffect(() => {
        if (viewMode !== VIEW_MODE.MAP) return;

        const canvas = gl.domElement;
        const handleWheel = (e) => {
            e.preventDefault();
            lastInteractionRef.current = Date.now();

            const zoomingIn = e.deltaY < 0;
            const zoomFraction = 0.12;

            if (zoomingIn) {
                // Zoom IN: dolly camera toward the 3D point under cursor
                // Do NOT call lookAt — the camera keeps its orientation, view shifts naturally
                raycaster.setFromCamera(pointer, camera);
                const hitPoint = new THREE.Vector3();
                const hit = raycaster.ray.intersectPlane(galaxyPlane, hitPoint);

                if (hit) {
                    const toHit = new THREE.Vector3().subVectors(hitPoint, camera.position);
                    if (toHit.length() > MIN_DIST) {
                        camera.position.addScaledVector(toHit, zoomFraction);
                    }
                } else {
                    // Fallback: move camera forward along its direction
                    const fwd = new THREE.Vector3();
                    camera.getWorldDirection(fwd);
                    camera.position.addScaledVector(fwd, camera.position.y * zoomFraction);
                }

                // Don't go below the galaxy plane
                camera.position.y = Math.max(camera.position.y, 5);

            } else {
                // Zoom OUT: lerp camera position AND angle back to default
                const distToDefault = camera.position.distanceTo(DEFAULT_CAM_POS);

                if (distToDefault < 5) {
                    camera.position.copy(DEFAULT_CAM_POS);
                    camera.quaternion.copy(defaultQuat);
                } else {
                    const moveAmount = Math.max(distToDefault * zoomFraction, 15);
                    const moveDir = new THREE.Vector3().subVectors(DEFAULT_CAM_POS, camera.position).normalize();
                    camera.position.addScaledVector(moveDir, moveAmount);

                    // Blend angle back toward default
                    camera.quaternion.slerp(defaultQuat, 0.12);
                }

                // Also lerp galaxy group back toward origin (undo drags + tilt)
                if (galaxyRef.current) {
                    galaxyRef.current.position.lerp(DEFAULT_TARGET, 0.08);
                    galaxyRef.current.rotation.x *= 0.92; // Smoothly undo tilt
                }
            }

            // Safety: don't fly beyond max distance
            if (camera.position.length() > MAX_DIST) {
                camera.position.copy(DEFAULT_CAM_POS);
                camera.quaternion.copy(defaultQuat);
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [camera, gl, viewMode, raycaster, pointer, galaxyPlane, galaxyRef, lastInteractionRef, defaultQuat]);

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
    const galaxyGroupRef = useRef();
    const lastInteractionRef = useRef(Date.now());

    useEffect(() => {
        loadStars();
    }, []);

    const loadStars = async (term = "") => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchStars({ search: term, limit: 5000 });
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

        // Reset idle timer on selection
        lastInteractionRef.current = Date.now();

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
                        galaxyRef={galaxyGroupRef}
                        lastInteractionRef={lastInteractionRef}
                        isHoveringStar={isHoveringStar}
                        viewMode={viewMode}
                    />

                    <GalaxyDragger
                        galaxyRef={galaxyGroupRef}
                        lastInteractionRef={lastInteractionRef}
                        viewMode={viewMode}
                    />

                    <ZoomToPointer
                        galaxyRef={galaxyGroupRef}
                        lastInteractionRef={lastInteractionRef}
                        viewMode={viewMode}
                    />

                    {/* Galaxy group — all scene content rotates together */}
                    <group ref={galaxyGroupRef}>
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
                    </group>

                    <OrbitControls
                        ref={controlsRef}
                        enablePan={false}
                        enableZoom={false}
                        enableRotate={false}
                        enabled={false}
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
