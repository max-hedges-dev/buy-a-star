import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { fetchStars } from '../services/api';
import { Search } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import UniverseMap from '../components/UniverseMap';
import StarViewer from '../components/StarViewer';
import GalaxyBackdropSphere from '../components/GalaxyBackdropSphere';
import GalaxyBackground from '../components/GalaxyBackground';
import BuyAStarGrid from '../components/BuyAStarGrid';
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
    DISPLAY: 'DISPLAY',
    GRID: 'GRID' // New mode for the "Buy a Star" marketplace
};

const slugifyStarName = (value) => (
    (value || '')
        .toString()
        .toLowerCase()
        .trim()
        .replace(/['’.]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
);

const getStarSlug = (star) => slugifyStarName(star.common_name || star.display_name || star.scientific_name);

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
    const { gl, camera } = useThree();

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

            // Camera sits at (0, 800, 2400) — its natural elevation above the plane is ~18°
            const cameraElevation = Math.atan2(camera.position.y, camera.position.z); // ~0.32 rad
            // Effective viewing angle = camera elevation + galaxy tilt. When ≈0, we're edge-on.
            const effectiveAngle = Math.abs(cameraElevation + (galaxyRef.current ? galaxyRef.current.rotation.x : 0));
            // Scale from 0 (edge-on) to ~0.32 (top-down). Squared for 3x more dramatic falloff
            const ratio = THREE.MathUtils.clamp(effectiveAngle / 0.35, 0, 1);
            const sensitivityScale = Math.max(ratio * ratio, 0.02);

            // Horizontal drag = spin around Y
            galaxyRef.current.rotation.y += dx * 0.004 * sensitivityScale;

            // Vertical drag = tilt around X (clamped to ±60°)
            const newTilt = galaxyRef.current.rotation.x + dy * 0.003 * sensitivityScale;
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
    }, [gl, galaxyRef, viewMode, lastInteractionRef, camera]);

    return null;
};

// --- ZOOM TO POINTER ---
// Re-architected for ultra-smooth damped interpolation and linear velocity scaling
const ZoomToPointer = ({ galaxyRef, lastInteractionRef, viewMode }) => {
    const { camera, gl, raycaster, pointer } = useThree();
    
    // Persistent smoothing targets
    const targetPos = useRef(null);
    const targetQuat = useRef(null);
    const lastWheelTime = useRef(0);
    const zoomPlane = useRef(new THREE.Plane());
    const planeNormal = useRef(new THREE.Vector3());
    const planePoint = useRef(new THREE.Vector3());
    const zoomAnchor = useRef(new THREE.Vector3());
    const galaxyQuat = useRef(new THREE.Quaternion());
    const anchorDir = useRef(new THREE.Vector3());
    const planeOffset = useRef(new THREE.Vector3());

    // Store default quaternion
    const defaultQuat = React.useMemo(() => {
        const cam = new THREE.PerspectiveCamera();
        cam.position.copy(DEFAULT_CAM_POS);
        cam.lookAt(DEFAULT_TARGET);
        return cam.quaternion.clone();
    }, []);

    useFrame((state, delta) => {
        if (viewMode !== VIEW_MODE.MAP) return;
        
        // Initialize targets on first frame
        if (!targetPos.current) {
            targetPos.current = state.camera.position.clone();
            targetQuat.current = state.camera.quaternion.clone();
        }

        // Only hijack the camera physics if the user physically spun the scroll wheel recently
        if (Date.now() - lastWheelTime.current < 400) {
            // Smoothly damp the true camera towards the scroll targets (10 units/s)
            state.camera.position.lerp(targetPos.current, 10 * delta);
            state.camera.quaternion.slerp(targetQuat.current, 10 * delta);
        } else {
            // Keep the scroll targets synchronized to the camera's true position 
            // so that cinematic programmatic fly-ins from UniverseMap are respected!
            targetPos.current.copy(state.camera.position);
            targetQuat.current.copy(state.camera.quaternion);
        }
    });

    useEffect(() => {
        if (viewMode !== VIEW_MODE.MAP) return;

        const canvas = gl.domElement;
        const handleWheel = (e) => {
            e.preventDefault();
            lastInteractionRef.current = Date.now();
            lastWheelTime.current = Date.now();
            
            // Guarantee target vectors are bound before mathematical manipulation
            if (!targetPos.current) return;

            const zoomingIn = e.deltaY < 0;
            let planeDistance = Math.max(targetPos.current.y, 1);
            let planeSide = 1;

            if (galaxyRef.current) {
                galaxyRef.current.updateWorldMatrix(true, false);
                galaxyRef.current.getWorldPosition(planePoint.current);
                planeNormal.current
                    .set(0, 1, 0)
                    .applyQuaternion(galaxyRef.current.getWorldQuaternion(galaxyQuat.current))
                    .normalize();
                zoomPlane.current.setFromNormalAndCoplanarPoint(planeNormal.current, planePoint.current);

                const signedPlaneDistance = zoomPlane.current.distanceToPoint(targetPos.current);
                planeSide = Math.sign(signedPlaneDistance) || 1;
                planeDistance = Math.max(Math.abs(signedPlaneDistance), 1);
            }
            
            // Linear velocity curve — scales with height but has a reasonable minimum.
            // Near the floor, use a much gentler speed to allow fine downward approach.
            const moveSpeed = Math.max(planeDistance * 0.15, 5); 

            if (zoomingIn) {
                // Zoom IN: Compute NDC from the wheel event position for accurate ray direction
                const rect = canvas.getBoundingClientRect();
                const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                const mouseNDC = new THREE.Vector2(ndcX, ndcY);
                
                raycaster.setFromCamera(mouseNDC, camera);
                const rayDir = raycaster.ray.direction.clone().normalize();

                let anchoredZoom = false;
                if (galaxyRef.current) {
                    // Move straight toward the true cursor anchor on the rotated galaxy plane.
                    if (raycaster.ray.intersectPlane(zoomPlane.current, zoomAnchor.current)) {
                        anchorDir.current.copy(zoomAnchor.current).sub(targetPos.current);
                        const distanceToAnchor = anchorDir.current.length();

                        if (distanceToAnchor > MIN_DIST) {
                            const step = Math.min(moveSpeed, distanceToAnchor - MIN_DIST);
                            targetPos.current.addScaledVector(anchorDir.current.normalize(), step);
                            anchoredZoom = true;
                        }
                    }
                }

                if (!anchoredZoom) {
                    targetPos.current.addScaledVector(rayDir, moveSpeed);
                }

                // Stay just above the galaxy plane even when the galaxy is tilted in world space.
                if (galaxyRef.current) {
                    const nextPlaneDistance = zoomPlane.current.distanceToPoint(targetPos.current);
                    if (nextPlaneDistance * planeSide < 0.5) {
                        planeOffset.current.copy(planeNormal.current).multiplyScalar((planeSide * 0.5) - nextPlaneDistance);
                        targetPos.current.add(planeOffset.current);
                    }
                } else {
                    targetPos.current.y = Math.max(targetPos.current.y, 0.5);
                }
            } else {
                // Zoom OUT: Pull straight backwards out of the camera's local focal rotation
                const fwd = new THREE.Vector3();
                camera.getWorldDirection(fwd);
                targetPos.current.addScaledVector(fwd, -moveSpeed);

                // Auto-Leveling constraint slowly pulls camera back to standard cinematic wide-view
                if (planeDistance > 50) {
                    const blendFactor = Math.min((planeDistance - 50) / 1000, 0.15); // Faster 15% angular recovery
                    targetPos.current.lerp(DEFAULT_CAM_POS, blendFactor);
                    targetQuat.current.slerp(defaultQuat, blendFactor);

                    // Revert global rotation drags concurrently
                    if (galaxyRef.current) {
                        galaxyRef.current.rotation.x *= (1 - blendFactor);
                        galaxyRef.current.position.lerp(DEFAULT_TARGET, blendFactor);
                    }
                }
            }

            // Outer Bounds Limit Enforcement
            if (targetPos.current.length() > MAX_DIST) {
                targetPos.current.copy(DEFAULT_CAM_POS);
                targetQuat.current.copy(defaultQuat);
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [camera, gl, viewMode, raycaster, pointer, galaxyRef, lastInteractionRef, defaultQuat]);

    return null;
};

const CAMERA_SETTINGS = { position: [0, 800, 2400], fov: 60, far: 100000 };

const SearchPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isBuyRoute = location.pathname.startsWith('/buy');
    const baseRoute = isBuyRoute ? '/buy' : '/search';
    const starSlug = location.pathname.startsWith(`${baseRoute}/`)
        ? location.pathname.slice(baseRoute.length + 1).split('/')[0]
        : '';

    // Data State
    const [stars, setStars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // View State
    const [viewMode, setViewMode] = useState(isBuyRoute ? VIEW_MODE.GRID : VIEW_MODE.MAP);
    const [previousViewMode, setPreviousViewMode] = useState(null); // Tracks where we came from
    const [selectedStar, setSelectedStar] = useState(null); // The star currently in focus/display
    const [targetStar, setTargetStar] = useState(null);     // The star map is zooming towards
    const [targetZoomScale, setTargetZoomScale] = useState(1);

    // UI State
    const [searchTerm, setSearchTerm] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [forceTooltipStar, setForceTooltipStar] = useState(null);
    const [macroFlyInMode, setMacroFlyInMode] = useState(false);

    // Idle State
    const [isHoveringStar, setIsHoveringStar] = useState(false);
    const controlsRef = useRef();
    const galaxyGroupRef = useRef();
    const lastInteractionRef = useRef(Date.now());
    const pendingSlugNavigationRef = useRef(null);
    const handledPreserveTargetKeyRef = useRef(null);
    const forceIdleNow = useCallback(() => {
        lastInteractionRef.current = Date.now() - IDLE_TIMEOUT - 1;
    }, []);

    useEffect(() => {
        loadStars();
    }, []);

    useEffect(() => {
        if (baseRoute === '/search' && !starSlug && !location.state?.preserveTarget) {
            forceIdleNow();
        }
    }, [baseRoute, starSlug, location.state, forceIdleNow]);

    // Sync view mode with navbar navigation
    const prevLocationRef = useRef(location.pathname);
    useEffect(() => {
        if (location.pathname !== prevLocationRef.current) {
            prevLocationRef.current = location.pathname;
            
            // Allow programmatic navigation (e.g. View in Galaxy) to safely manage its own state
            if (location.state?.preserveTarget) return;

            if (baseRoute === '/buy' && !starSlug) {
                setViewMode(VIEW_MODE.GRID);
                setSelectedStar(null);
                setTargetStar(null);
                setTargetZoomScale(1);
            } else if (baseRoute === '/search' && !starSlug) {
                setViewMode(VIEW_MODE.MAP);
                setSelectedStar(null);
                setTargetStar(null);
                setTargetZoomScale(1);
                forceIdleNow();
            }
        }
    }, [location.pathname, location.state, forceIdleNow, baseRoute, starSlug]);

    useEffect(() => {
        if (loading || !stars.length || !starSlug || location.state?.preserveTarget) {
            return;
        }

        if (pendingSlugNavigationRef.current === starSlug) {
            return;
        }

        const matchingStar = stars.find((star) => getStarSlug(star) === starSlug);
        if (!matchingStar) {
            navigate(baseRoute, { replace: true });
            return;
        }

        if (selectedStar?.id === matchingStar.id) {
            return;
        }

        setPreviousViewMode(baseRoute === '/buy' ? VIEW_MODE.GRID : VIEW_MODE.MAP);
        setSelectedStar(matchingStar);
        setTargetStar(null);
        setTargetZoomScale(1);
        setViewMode(VIEW_MODE.DISPLAY);
    }, [loading, stars, starSlug, location.state, navigate, baseRoute, selectedStar]);

    useEffect(() => {
        if (
            pendingSlugNavigationRef.current &&
            starSlug === pendingSlugNavigationRef.current &&
            selectedStar &&
            getStarSlug(selectedStar) === pendingSlugNavigationRef.current &&
            viewMode === VIEW_MODE.DISPLAY
        ) {
            pendingSlugNavigationRef.current = null;
        }
    }, [selectedStar, starSlug, viewMode]);

    useEffect(() => {
        if (!location.state?.preserveTarget || !location.state?.focusStarSlug || loading || !stars.length) {
            return;
        }

        if (handledPreserveTargetKeyRef.current === location.key) {
            return;
        }

        const matchingStar = stars.find((star) => getStarSlug(star) === location.state.focusStarSlug);
        if (!matchingStar) {
            return;
        }

        handledPreserveTargetKeyRef.current = location.key;
        setViewMode(VIEW_MODE.MAP);
        setSelectedStar(null);
        setMacroFlyInMode(Boolean(location.state?.macroFlyInMode));
        setTargetZoomScale(location.state?.targetZoomScale || 1);
        setTargetStar(matchingStar);
        lastInteractionRef.current = Infinity;
        setForceTooltipStar(matchingStar);

        const timeoutId = window.setTimeout(() => {
            setTargetStar(null);
            setTargetZoomScale(1);
            setMacroFlyInMode(false);
            setForceTooltipStar(null);
        }, location.state?.macroFlyInMode ? 4000 : 2800);

        return () => window.clearTimeout(timeoutId);
    }, [location.key, location.state, loading, stars]);

    const loadStars = async (term = "") => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchStars({ search: term, limit: 20000 });
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
        const nextStarSlug = getStarSlug(star);
        const starPath = `${baseRoute}/${nextStarSlug}`;
        setPreviousViewMode(viewMode);
        pendingSlugNavigationRef.current = nextStarSlug;

        if (viewMode === VIEW_MODE.GRID) {
            // From grid, we just instantly go to DISPLAY mode (no 3D zoom needed since we can't see the map)
            setSelectedStar(star);
            setViewMode(VIEW_MODE.DISPLAY);
            navigate(starPath);
            return;
        }

        if (viewMode !== VIEW_MODE.MAP) return;

        setMacroFlyInMode(false); // Smooth local glide
        setTargetZoomScale(1);
        setSelectedStar(star);
        setTargetStar(star); // Tells UniverseMap to zoom camera towards this point
        navigate(starPath);

        // Reset idle timer on selection
        lastInteractionRef.current = Date.now();

        // 1. Zoom starts via UniverseMap (useEffect on targetStar) OR we animate here?
        // Let's let UniverseMap handle the 'glimpse' zoom for 1.5s, then blur.

        // Wait for zoom to nearly finish before blurring
        setTimeout(() => {
            setViewMode(VIEW_MODE.TRANSITION);

            // Wait for blur fade-in
            setTimeout(() => {
                setViewMode(VIEW_MODE.DISPLAY);
                setTargetStar(null); // Stop map zoom
                setTargetZoomScale(1);
            }, 1000); // 1s blur in

        }, 2800); // 2.8s zoom time before blur covers the remaining frames
    };

    const handleBackToMap = () => {
        pendingSlugNavigationRef.current = null;
        if (previousViewMode === VIEW_MODE.GRID) {
            setViewMode(VIEW_MODE.GRID);
            setSelectedStar(null);
            setTargetStar(null);
            setTargetZoomScale(1);
            navigate('/buy');
            return;
        }

        setViewMode(VIEW_MODE.MAP);
        setSelectedStar(null);
        setTargetStar(null);
        setTargetZoomScale(1);
        navigate('/search');
        lastInteractionRef.current = Infinity; // Disable idle spin until user interacts
    };

    const handleViewInGalaxy = () => {
        const star = selectedStar;
        pendingSlugNavigationRef.current = null;
        const shouldMacroFlyIn = previousViewMode !== VIEW_MODE.MAP;

        navigate('/search', {
            state: {
                preserveTarget: true,
                focusStarSlug: getStarSlug(star),
                macroFlyInMode: shouldMacroFlyIn,
                targetZoomScale: 0.2,
            },
        });
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
                <Canvas camera={CAMERA_SETTINGS}>
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
                        <GalaxyBackdropSphere />
                        <GalaxyBackground count={400} />

                        {!loading && stars.length > 0 && (
                            <UniverseMap
                                stars={stars}
                                viewMode={viewMode}
                                onSelectStar={triggerTransitionToStar}
                                targetStar={targetStar}
                                targetZoomScale={targetZoomScale}
                                onHoverChange={setIsHoveringStar}
                                forceTooltipStar={forceTooltipStar}
                                macroFlyInMode={macroFlyInMode}
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
                    transition: isBuyRoute ? 'none' : 'opacity 0.2s ease-in',
                    background: isBuyRoute ? 'black' : 'transparent' // Solid background for grid transition
                }}>
                    <StarViewer
                        star={selectedStar}
                        onBack={handleBackToMap}
                        onSuccess={() => { loadStars(); alert("Star Purchased!"); }}
                        onViewInGalaxy={handleViewInGalaxy}
                    />
                </div>
            )}

            {/* --- GRID LAYER (Marketplace) --- */}
            <div style={{
                display: viewMode === VIEW_MODE.GRID ? 'block' : 'none',
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5
            }}>
                <BuyAStarGrid
                    stars={stars}
                    loading={loading}
                    error={error}
                    onSelectStar={triggerTransitionToStar}
                />
            </div>

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
        </div>
    );
};

export default SearchPage;
