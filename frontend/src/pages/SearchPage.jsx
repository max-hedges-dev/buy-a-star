import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { fetchStarBySlug, fetchStars } from '../services/api';
import { Search } from 'lucide-react';
import BuyAStarGrid from '../components/BuyAStarGrid';

const loadStarViewer = () => import('../components/StarViewer');
const StarViewer = lazy(loadStarViewer);
const GalaxyMapLayer = lazy(() => import('../components/GalaxyMapLayer'));
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

const GalaxyLoadingIndicator = ({ label = 'Loading galaxy...' }) => (
    <div
        style={{
            position: 'absolute',
            inset: 0,
            zIndex: 210,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 50%, rgba(255,94,24,0.08), rgba(0,0,0,0) 34%)',
        }}
    >
        <style>
            {`
                @keyframes galaxyLoadingSpin {
                    to { transform: rotate(360deg); }
                }

                @keyframes galaxyLoadingPulse {
                    0%, 100% { opacity: 0.68; }
                    50% { opacity: 1; }
                }
            `}
        </style>
        <div
            style={{
                display: 'grid',
                justifyItems: 'center',
                gap: '18px',
                color: 'white',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                fontWeight: 800,
            }}
        >
            <div
                style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderTopColor: '#ff6a00',
                    borderRightColor: 'rgba(255,160,92,0.7)',
                    boxShadow: '0 0 32px rgba(255,94,24,0.2), inset 0 0 18px rgba(255,255,255,0.04)',
                    animation: 'galaxyLoadingSpin 0.9s linear infinite',
                }}
            />
            <div
                style={{
                    fontSize: 'clamp(1.1rem, 2vw, 1.65rem)',
                    animation: 'galaxyLoadingPulse 1.6s ease-in-out infinite',
                    textShadow: '0 0 24px rgba(255,94,24,0.22)',
                }}
            >
                {label}
            </div>
        </div>
    </div>
);

const SearchPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isBuyRoute = location.pathname.startsWith('/buy');
    const baseRoute = isBuyRoute ? '/buy' : '/search';
    const starSlug = location.pathname.startsWith(`${baseRoute}/`)
        ? location.pathname.slice(baseRoute.length + 1).split('/')[0]
        : '';
    const preserveTarget = Boolean(location.state?.preserveTarget);

    // Data State
    const [stars, setStars] = useState([]);
    const [loading, setLoading] = useState(!starSlug);
    const [error, setError] = useState(null);

    // View State
    const [viewMode, setViewMode] = useState(starSlug ? VIEW_MODE.DISPLAY : (isBuyRoute ? VIEW_MODE.GRID : VIEW_MODE.MAP));
    const [previousViewMode, setPreviousViewMode] = useState(null); // Tracks where we came from
    const [selectedStar, setSelectedStar] = useState(null); // The star currently in focus/display
    const [targetStar, setTargetStar] = useState(null);     // The star map is zooming towards
    const [targetZoomScale, setTargetZoomScale] = useState(1);
    const [starRouteLoading, setStarRouteLoading] = useState(Boolean(starSlug));

    // UI State
    const [searchTerm, setSearchTerm] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [forceTooltipStar, setForceTooltipStar] = useState(null);
    const [macroFlyInMode, setMacroFlyInMode] = useState(false);
    const [galaxyBackdropReady, setGalaxyBackdropReady] = useState(false);
    const [galaxyMapReady, setGalaxyMapReady] = useState(false);

    // Idle State
    const [isHoveringStar, setIsHoveringStar] = useState(false);
    const galaxyGroupRef = useRef();
    const lastInteractionRef = useRef(Date.now());
    const backgroundCatalogueRequestedRef = useRef(false);
    const pendingSlugNavigationRef = useRef(null);
    const handledPreserveTargetKeyRef = useRef(null);
    const forceIdleNow = useCallback(() => {
        lastInteractionRef.current = Date.now() - IDLE_TIMEOUT - 1;
    }, []);
    const hasCatalogue = stars.length > 0;
    const isPlainGridRoute = baseRoute === '/buy' && !starSlug && !preserveTarget;
    const canRenderGalaxyScene = hasCatalogue && !loading && !error;
    const wantsGalaxyScene = !isPlainGridRoute && (
        viewMode === VIEW_MODE.MAP ||
        viewMode === VIEW_MODE.TRANSITION ||
        Boolean(targetStar)
    );
    const shouldMountMapLayer = canRenderGalaxyScene && wantsGalaxyScene;
    const shouldShowMapLayer = canRenderGalaxyScene && (
        viewMode === VIEW_MODE.MAP ||
        (viewMode === VIEW_MODE.TRANSITION && Boolean(targetStar))
    );
    const galaxySceneReady = shouldShowMapLayer && galaxyBackdropReady && galaxyMapReady;
    const shouldShowFullScreenLoader = !isPlainGridRoute && !selectedStar && (
        loading ||
        starRouteLoading ||
        (shouldShowMapLayer && !galaxySceneReady)
    );

    const handleGalaxyBackdropReady = useCallback(() => {
        setGalaxyBackdropReady(true);
    }, []);

    const handleGalaxyMapReady = useCallback(() => {
        setGalaxyMapReady(true);
    }, []);

    const loadStars = useCallback(async (term = "") => {
        setGalaxyBackdropReady(false);
        setGalaxyMapReady(false);
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
    }, []);

    // Catalogue routes must always hydrate themselves. Direct star-detail routes
    // can stay fast, then warm the catalogue in the background for "View in Galaxy".
    useEffect(() => {
        if (isPlainGridRoute) {
            setLoading(false);
            return;
        }

        if (starSlug && !preserveTarget) {
            return;
        }

        loadStars();
    }, [isPlainGridRoute, loadStars, preserveTarget, starSlug]);

    useEffect(() => {
        if (isBuyRoute || !starSlug || preserveTarget || !selectedStar || stars.length || backgroundCatalogueRequestedRef.current) {
            return undefined;
        }

        backgroundCatalogueRequestedRef.current = true;
        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(() => loadStars());
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = window.setTimeout(() => loadStars(), 1500);
        return () => window.clearTimeout(timeoutId);
    }, [isBuyRoute, loadStars, preserveTarget, selectedStar, stars.length, starSlug]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (isPlainGridRoute) return undefined;

        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(loadStarViewer);
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = window.setTimeout(loadStarViewer, 1200);
        return () => window.clearTimeout(timeoutId);
    }, [isPlainGridRoute]);

    useEffect(() => {
        if (baseRoute === '/search' && !starSlug && !preserveTarget) {
            forceIdleNow();
        }
    }, [baseRoute, starSlug, preserveTarget, forceIdleNow]);

    // Sync view mode with navbar navigation
    const prevLocationRef = useRef(location.pathname);
    useEffect(() => {
        if (location.pathname !== prevLocationRef.current) {
            prevLocationRef.current = location.pathname;
            
            // Allow programmatic navigation (e.g. View in Galaxy) to safely manage its own state
            if (preserveTarget) return;
            if (pendingSlugNavigationRef.current === starSlug) return;

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
            } else if (starSlug) {
                setViewMode(VIEW_MODE.DISPLAY);
                setTargetStar(null);
                setTargetZoomScale(1);
                if (!selectedStar || getStarSlug(selectedStar) !== starSlug) {
                    setSelectedStar(null);
                }
            }
        }
    }, [location.pathname, preserveTarget, forceIdleNow, baseRoute, starSlug, selectedStar]);

    useEffect(() => {
        if (!starSlug || preserveTarget) {
            setStarRouteLoading(false);
            return undefined;
        }

        if (pendingSlugNavigationRef.current === starSlug) {
            setStarRouteLoading(false);
            return undefined;
        }

        if (selectedStar && getStarSlug(selectedStar) === starSlug) {
            setStarRouteLoading(false);
            return undefined;
        }

        let isActive = true;
        setStarRouteLoading(true);
        setViewMode(VIEW_MODE.DISPLAY);

        fetchStarBySlug(starSlug)
            .then((star) => {
                if (!isActive) return;
                setPreviousViewMode(baseRoute === '/buy' ? VIEW_MODE.GRID : VIEW_MODE.MAP);
                setSelectedStar(star);
                setTargetStar(null);
                setTargetZoomScale(1);
                setViewMode(VIEW_MODE.DISPLAY);
            })
            .catch((requestError) => {
                console.error(requestError);
                if (!isActive) return;
                setError(requestError.message);
                navigate(baseRoute, { replace: true });
            })
            .finally(() => {
                if (isActive) {
                    setStarRouteLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [starSlug, preserveTarget, selectedStar, navigate, baseRoute]);

    useEffect(() => {
        if (loading || !stars.length || !starSlug || preserveTarget) {
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
    }, [loading, stars, starSlug, preserveTarget, navigate, baseRoute, selectedStar]);

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
    const triggerTransitionToStar = useCallback((star) => {
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
    }, [baseRoute, navigate, viewMode]);

    const handleBackToMap = () => {
        pendingSlugNavigationRef.current = null;
        if (previousViewMode === VIEW_MODE.GRID) {
            setSelectedStar(null);
            setTargetStar(null);
            setTargetZoomScale(1);
            setStarRouteLoading(false);
            setViewMode(VIEW_MODE.GRID);
            navigate('/buy');
            return;
        }

        setSelectedStar(null);
        setTargetStar(null);
        setTargetZoomScale(1);
        setStarRouteLoading(false);
        setViewMode(VIEW_MODE.MAP);
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
            {shouldMountMapLayer && (
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 1,
                // Hide Map if showing Display OR if Transitioning BACK to Map (blurring display)
                visibility: shouldShowMapLayer ? 'visible' : 'hidden',
                opacity: galaxySceneReady ? 1 : 0,
                transition: 'opacity 0.32s ease',
                pointerEvents: galaxySceneReady ? 'auto' : 'none',
            }}>
                <Suspense fallback={<GalaxyLoadingIndicator />}>
                    <GalaxyMapLayer
                        canRenderGalaxyScene={canRenderGalaxyScene}
                        forceTooltipStar={forceTooltipStar}
                        galaxyGroupRef={galaxyGroupRef}
                        handleGalaxyBackdropReady={handleGalaxyBackdropReady}
                        handleGalaxyMapReady={handleGalaxyMapReady}
                        isHoveringStar={isHoveringStar}
                        lastInteractionRef={lastInteractionRef}
                        macroFlyInMode={macroFlyInMode}
                        onSelectStar={triggerTransitionToStar}
                        setIsHoveringStar={setIsHoveringStar}
                        shouldShowMapLayer={shouldShowMapLayer}
                        stars={stars}
                        targetStar={targetStar}
                        targetZoomScale={targetZoomScale}
                        viewMode={viewMode}
                    />
                </Suspense>

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
            )}

            {/* --- DISPLAY LAYER --- */}
            {selectedStar && viewMode !== VIEW_MODE.GRID && viewMode !== VIEW_MODE.MAP && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    zIndex: 200,
                    // Show Display if DISPLAY mode OR if Transitioning BACK (blurring display)
                    opacity: (viewMode === VIEW_MODE.DISPLAY || (viewMode === VIEW_MODE.TRANSITION && !targetStar)) ? 1 : 0,
                    pointerEvents: viewMode === VIEW_MODE.DISPLAY ? 'auto' : 'none',
                    transition: isBuyRoute ? 'none' : 'opacity 0.2s ease-in',
                    background: isBuyRoute ? 'black' : 'transparent' // Solid background for grid transition
                }}>
                    <Suspense fallback={null}>
                        <StarViewer
                            star={selectedStar}
                            onBack={handleBackToMap}
                            onSuccess={() => {
                                if (!isBuyRoute) loadStars();
                                alert("Star Purchased!");
                            }}
                            onViewInGalaxy={handleViewInGalaxy}
                        />
                    </Suspense>
                </div>
            )}

            {/* --- GRID LAYER (Marketplace) --- */}
            <div style={{
                display: viewMode === VIEW_MODE.GRID && !starSlug ? 'block' : 'none',
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5
            }}>
                <BuyAStarGrid
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
            {shouldShowFullScreenLoader && (
                <GalaxyLoadingIndicator label={starSlug ? 'Loading star...' : 'Loading galaxy...'} />
            )}
        </div>
    );
};

export default SearchPage;
