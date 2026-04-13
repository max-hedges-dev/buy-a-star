import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import StarTile from './StarTile';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { fetchStarCatalogue } from '../services/api';

const LIMIT = 24;
const CONTENT_TOP_OFFSET = 100;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const filterSectionTitle = {
    color: '#ff9150',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: '0.74rem',
    marginBottom: '12px',
};

const radioLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#d8d8de',
    fontSize: '0.96rem',
    cursor: 'pointer',
};

const selectStyle = {
    width: '100%',
    background: 'linear-gradient(180deg, rgba(19,19,24,0.98) 0%, rgba(11,11,15,1) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#dedee6',
    padding: '12px 14px',
    fontSize: '0.95rem',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23b6b6be' d='M6 8 0 0h12z'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '38px',
};

const inputStyle = {
    width: '100%',
    background: 'linear-gradient(180deg, rgba(19,19,24,0.98) 0%, rgba(11,11,15,1) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#dedee6',
    padding: '12px 14px',
    fontSize: '0.95rem',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

const optionStyle = {
    background: '#0d0d11',
    color: '#d7d7de',
};

const sliderStyle = {
    width: '100%',
    accentColor: '#ff6a00',
    cursor: 'pointer',
};

const LoadingTile = () => (
    <div
        style={{
            background: 'linear-gradient(180deg, rgba(20,20,30,0.86) 0%, rgba(15,15,24,0.94) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflow: 'hidden',
            minHeight: '320px',
        }}
    >
        <div style={{ height: '100px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ width: '68%', height: '24px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ width: '55%', height: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ width: '80%', height: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ marginTop: 'auto', width: '100%', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)' }} />
    </div>
);

const getCatalogueErrorMessage = (error) => {
    const message = error?.message ?? error?.payload?.detail ?? error?.payload?.message ?? error;

    if (typeof message === 'string') {
        return message;
    }

    if (Array.isArray(message)) {
        const firstMessage = message.find((item) => item?.msg)?.msg;
        if (firstMessage) {
            return firstMessage;
        }
    }

    return 'Unable to load stars right now.';
};

const BuyAStarGrid = ({ onSelectStar }) => {
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('unclaimed');
    const [colorFilter, setColorFilter] = useState('all');
    const [constellationFilter, setConstellationFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState('alphabetical');
    const [catalogue, setCatalogue] = useState({
        items: [],
        total: 0,
        page: 1,
        page_size: LIMIT,
        total_pages: 1,
        facets: {
            constellations: [],
            star_types: [],
            max_distance_ly: 0,
        },
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterTopOffset, setFilterTopOffset] = useState(CONTENT_TOP_OFFSET);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
    }));
    const gridStartRef = useRef(null);
    const [maxDistance, setMaxDistance] = useState(0);
    const pagedStars = catalogue.items || [];
    const totalStars = catalogue.total || 0;
    const totalPages = Math.max(1, catalogue.total_pages || 1);
    const constellations = catalogue.facets?.constellations || [];
    const starTypes = catalogue.facets?.star_types || [];
    const maxDistanceCap = Math.ceil(catalogue.facets?.max_distance_ly || 0);
    const distanceSliderValue = maxDistance > 0
        ? Math.min(maxDistance, maxDistanceCap || maxDistance)
        : (maxDistanceCap || 1);
    const isAnyDistance = maxDistanceCap === 0 || maxDistance === 0 || maxDistance >= maxDistanceCap;

    const measureFilterTop = useCallback(() => {
        if (!gridStartRef.current) return;
        const nextTop = Math.round(gridStartRef.current.getBoundingClientRect().top);
        if (nextTop > 0) {
            setFilterTopOffset(nextTop);
        }
    }, []);

    useEffect(() => {
        const handleResize = () => setViewportSize({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 180);
        return () => window.clearTimeout(timeoutId);
    }, [searchTerm]);

    useEffect(() => {
        setPage(0);
    }, [searchTerm, statusFilter, colorFilter, constellationFilter, typeFilter, sortBy, maxDistance]);

    useEffect(() => {
        let isActive = true;
        setLoading(true);
        setError(null);

        const cappedDistance = maxDistanceCap > 0 && maxDistance > 0 && maxDistance < maxDistanceCap
            ? maxDistance
            : undefined;

        fetchStarCatalogue({
            page: page + 1,
            pageSize: LIMIT,
            search: debouncedSearchTerm,
            status: statusFilter,
            colour: colorFilter,
            constellation: constellationFilter,
            starType: typeFilter,
            maxDistanceLy: cappedDistance,
            sortBy,
        })
            .then((nextCatalogue) => {
                if (!isActive) return;
                setCatalogue(nextCatalogue);
            })
            .catch((catalogueError) => {
                console.error(catalogueError);
                if (!isActive) return;
                setError(getCatalogueErrorMessage(catalogueError));
            })
            .finally(() => {
                if (isActive) {
                    setLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [
        colorFilter,
        constellationFilter,
        debouncedSearchTerm,
        maxDistance,
        maxDistanceCap,
        page,
        sortBy,
        statusFilter,
        typeFilter,
    ]);

    useEffect(() => {
        if (page > totalPages - 1) {
            setPage(Math.max(totalPages - 1, 0));
        }
    }, [page, totalPages]);

    useLayoutEffect(() => {
        measureFilterTop();

        const handleResize = () => measureFilterTop();
        window.addEventListener('resize', handleResize);

        let observer;
        if (typeof ResizeObserver !== 'undefined' && gridStartRef.current) {
            observer = new ResizeObserver(() => measureFilterTop());
            observer.observe(gridStartRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            if (observer) observer.disconnect();
        };
    }, [measureFilterTop, loading, page, totalStars]);

    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('unclaimed');
        setColorFilter('all');
        setConstellationFilter('all');
        setTypeFilter('all');
        setSortBy('alphabetical');
        setMaxDistance(0);
    };

    const { width: viewportWidth, height: viewportHeight } = viewportSize;
    const pageScale = clamp(Math.min(viewportWidth / 1440, viewportHeight / 920), 0.72, 1.05);
    const useFilterDrawer = viewportWidth < 1020;
    const pagePaddingX = Math.round(clamp(32 * pageScale, 14, 32));
    const sidebarWidth = Math.round(clamp(310 * pageScale, 250, 310));
    const contentOffset = useFilterDrawer ? 0 : sidebarWidth + Math.round(clamp(34 * pageScale, 22, 34));
    const gridGap = Math.round(clamp(25 * pageScale, 14, 25));
    const cardMinWidth = useFilterDrawer
        ? Math.round(clamp(viewportWidth * 0.42, 154, 230))
        : Math.round(clamp(255 * pageScale, 196, 255));
    const filterPanelPadding = Math.round(clamp(24 * pageScale, 18, 24));
    const filterPanelGap = Math.round(clamp(22 * pageScale, 16, 22));

    useEffect(() => {
        if (!useFilterDrawer && isFilterDrawerOpen) {
            setIsFilterDrawerOpen(false);
        }
    }, [isFilterDrawerOpen, useFilterDrawer]);

    const filterControls = (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: `${filterPanelGap}px` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SlidersHorizontal size={18} color="#ff7a1f" />
                    <div style={{ fontSize: `${clamp(1.1 * pageScale, 0.98, 1.1).toFixed(3)}rem`, fontWeight: 700 }}>Filters</div>
                </div>
                <button
                    onClick={resetFilters}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#a7a7af',
                        cursor: 'pointer',
                        fontSize: `${clamp(0.9 * pageScale, 0.8, 0.9).toFixed(3)}rem`,
                    }}
                >
                    Reset
                </button>
            </div>

            <div style={{ display: 'grid', gap: `${filterPanelGap}px` }}>
                <div>
                    <div style={filterSectionTitle}>Search</div>
                    <div style={{ position: 'relative' }}>
                        <Search
                            size={16}
                            color="#868690"
                            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                        />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search stars or constellations"
                            style={{
                                ...inputStyle,
                                paddingLeft: '40px',
                            }}
                        />
                    </div>
                </div>

                <div>
                    <div style={filterSectionTitle}>Status</div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {[
                            { value: 'unclaimed', label: 'Unclaimed' },
                            { value: 'claimed', label: 'Claimed' },
                            { value: 'all', label: 'All stars' },
                        ].map((option) => (
                            <label key={option.value} style={radioLabelStyle}>
                                <input
                                    type="radio"
                                    name="status-filter"
                                    checked={statusFilter === option.value}
                                    onChange={() => setStatusFilter(option.value)}
                                    style={{ accentColor: '#ff6a00' }}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={filterSectionTitle}>Sort by</div>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={selectStyle}>
                        <option style={optionStyle} value="alphabetical">Alphabetical</option>
                        <option style={optionStyle} value="distance-near">Distance: nearest first</option>
                        <option style={optionStyle} value="distance-far">Distance: farthest first</option>
                        <option style={optionStyle} value="brightness">Brightness</option>
                        <option style={optionStyle} value="predicted-price">Predicted price</option>
                        <option style={optionStyle} value="claimed-first">Claimed first</option>
                    </select>
                </div>

                <div>
                    <div style={filterSectionTitle}>Colour</div>
                    <select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)} style={selectStyle}>
                        <option style={optionStyle} value="all">All colours</option>
                        <option style={optionStyle} value="Blue">Blue</option>
                        <option style={optionStyle} value="White">White</option>
                        <option style={optionStyle} value="Yellow">Yellow</option>
                        <option style={optionStyle} value="Orange">Orange</option>
                        <option style={optionStyle} value="Red">Red</option>
                        <option style={optionStyle} value="Other">Other</option>
                    </select>
                </div>

                <div>
                    <div style={filterSectionTitle}>Star type</div>
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={selectStyle}>
                        <option style={optionStyle} value="all">All types</option>
                        {starTypes.map((type) => (
                            <option key={type} value={type} style={optionStyle}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <div style={filterSectionTitle}>Constellation</div>
                    <select
                        value={constellationFilter}
                        onChange={(event) => setConstellationFilter(event.target.value)}
                        style={selectStyle}
                    >
                        <option style={optionStyle} value="all">All constellations</option>
                        {constellations.map((constellation) => (
                            <option key={constellation} value={constellation} style={optionStyle}>
                                {constellation}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <div style={filterSectionTitle}>Distance from Sun</div>
                    <div
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '14px',
                            padding: '14px 14px 16px',
                        }}
                    >
                        <input
                            type="range"
                            min={0}
                            max={maxDistanceCap || 1}
                            step={100}
                            value={distanceSliderValue}
                            onChange={(event) => setMaxDistance(Number(event.target.value))}
                            style={sliderStyle}
                        />
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '10px',
                                gap: '16px',
                                color: '#a4a4ad',
                                fontSize: '0.86rem',
                            }}
                        >
                            <span>0 ly</span>
                            <span style={{ color: '#ffffff', fontWeight: 600 }}>
                                {isAnyDistance ? 'Any distance' : `${maxDistance.toLocaleString()} ly max`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                overflowY: 'auto',
                background: 'black',
                color: 'white',
                zIndex: 10,
                padding: `${CONTENT_TOP_OFFSET}px ${pagePaddingX}px 48px`,
            }}
        >
            <div style={{ maxWidth: '1520px', margin: '0 auto' }}>
                <div
                    style={{
                        position: 'relative',
                        minHeight: '100%',
                    }}
                >
                    {!useFilterDrawer ? (
                        <aside
                            style={{
                                position: 'fixed',
                                top: `${filterTopOffset}px`,
                                left: `max(${pagePaddingX}px, calc((100vw - 1520px) / 2))`,
                                width: `${sidebarWidth}px`,
                                maxHeight: `calc(100vh - ${filterTopOffset + 24}px)`,
                                overflowY: 'auto',
                                background: 'linear-gradient(180deg, rgba(16,16,20,0.94) 0%, rgba(8,8,10,0.98) 100%)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: `${Math.round(24 * pageScale)}px`,
                                padding: `${filterPanelPadding}px`,
                                boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
                            }}
                        >
                            {filterControls}
                        </aside>
                    ) : null}

                    <div style={{ minWidth: 0, marginLeft: `${contentOffset}px` }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: useFilterDrawer ? 'stretch' : 'flex-end',
                                gap: `${Math.round(clamp(20 * pageScale, 14, 20))}px`,
                                marginBottom: `${Math.round(clamp(28 * pageScale, 20, 28))}px`,
                                flexWrap: 'wrap',
                            }}
                        >
                            <div>
                                <div style={{ color: '#ffffff', fontSize: `${clamp(1.15 * pageScale, 0.98, 1.15).toFixed(3)}rem`, fontWeight: 700, marginBottom: '6px' }}>
                                    {loading ? 'Loading stars...' : `${totalStars.toLocaleString()} stars`}
                                </div>
                                <div style={{ color: '#8f8f98', fontSize: `${clamp(0.95 * pageScale, 0.82, 0.95).toFixed(3)}rem` }}>
                                    Filtered by status, color, constellation, distance, and type.
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: useFilterDrawer ? 'space-between' : 'flex-end', flex: useFilterDrawer ? '1 1 100%' : '0 1 auto' }}>
                                {useFilterDrawer ? (
                                    <button
                                        onClick={() => setIsFilterDrawerOpen(true)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '9px',
                                            padding: '11px 16px',
                                            borderRadius: 999,
                                            background: 'linear-gradient(45deg, #ff4d00, #ff8800)',
                                            color: 'white',
                                            fontWeight: 800,
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            boxShadow: '0 0 22px rgba(255,77,0,0.28)',
                                        }}
                                        type="button"
                                    >
                                        <SlidersHorizontal size={16} />
                                        Open filters
                                    </button>
                                ) : null}
                                <div style={{ color: '#7f7f88', fontSize: `${clamp(0.92 * pageScale, 0.8, 0.92).toFixed(3)}rem` }}>
                                    {loading ? 'Preparing results' : `Page ${Math.min(page + 1, totalPages)} of ${totalPages}`}
                                </div>
                            </div>
                        </div>

                        <div ref={gridStartRef}>
                        {loading ? (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${cardMinWidth}px), 1fr))`,
                                    gap: `${gridGap}px`,
                                    marginBottom: `${Math.round(clamp(38 * pageScale, 26, 38))}px`,
                                }}
                            >
                                {Array.from({ length: 8 }).map((_, index) => (
                                    <LoadingTile key={index} />
                                ))}
                            </div>
                        ) : error ? (
                            <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '40px' }}>{error}</div>
                        ) : totalStars === 0 ? (
                            <div
                                style={{
                                    color: '#888',
                                    textAlign: 'center',
                                    padding: '120px 40px',
                                    fontSize: '1.05rem',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '24px',
                                    background: 'rgba(255,255,255,0.02)',
                                }}
                            >
                                No stars found matching these filters.
                            </div>
                        ) : (
                            <>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${cardMinWidth}px), 1fr))`,
                                        gap: `${gridGap}px`,
                                        marginBottom: `${Math.round(clamp(38 * pageScale, 26, 38))}px`,
                                    }}
                                >
                                    {pagedStars.map((star) => (
                                        <StarTile key={star.id} star={star} onClick={onSelectStar} scale={pageScale} />
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: `${Math.round(clamp(20 * pageScale, 12, 20))}px`, paddingBottom: '30px', flexWrap: 'wrap' }}>
                                    <button
                                        disabled={page === 0}
                                        onClick={() => setPage((currentPage) => currentPage - 1)}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            border: '1px solid #444',
                                            background: page === 0 ? 'transparent' : 'rgba(255,255,255,0.08)',
                                            color: page === 0 ? '#666' : 'white',
                                            cursor: page === 0 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <ChevronLeft size={20} /> Previous
                                    </button>
                                    <span style={{ fontSize: '1rem', color: '#aaa' }}>
                                        {Math.min(page + 1, totalPages)} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage((currentPage) => currentPage + 1)}
                                        disabled={page >= totalPages - 1}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            border: '1px solid #444',
                                            background: page >= totalPages - 1 ? 'transparent' : 'rgba(255,255,255,0.08)',
                                            color: page >= totalPages - 1 ? '#666' : 'white',
                                            cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        Next <ChevronRight size={20} />
                                    </button>
                                </div>
                            </>
                        )}
                        </div>
                    </div>
                </div>
            </div>

            {useFilterDrawer ? (
                <>
                    <div
                        onClick={() => setIsFilterDrawerOpen(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.52)',
                            opacity: isFilterDrawerOpen ? 1 : 0,
                            pointerEvents: isFilterDrawerOpen ? 'auto' : 'none',
                            transition: 'opacity 0.22s ease',
                            zIndex: 30,
                        }}
                    />
                    <aside
                        aria-hidden={!isFilterDrawerOpen}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: 'min(88vw, 360px)',
                            transform: isFilterDrawerOpen ? 'translateX(0)' : 'translateX(-104%)',
                            transition: 'transform 0.26s ease',
                            zIndex: 31,
                            overflowY: 'auto',
                            padding: `${CONTENT_TOP_OFFSET}px ${filterPanelPadding}px 28px`,
                            background: 'linear-gradient(180deg, rgba(16,16,20,0.98) 0%, rgba(8,8,10,1) 100%)',
                            borderRight: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '28px 0 80px rgba(0,0,0,0.52)',
                        }}
                    >
                        <button
                            onClick={() => setIsFilterDrawerOpen(false)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '9px',
                                width: '100%',
                                justifyContent: 'center',
                                marginBottom: '18px',
                                padding: '12px 16px',
                                borderRadius: 999,
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                            type="button"
                        >
                            <X size={16} />
                            Close filters
                        </button>
                        {filterControls}
                    </aside>
                </>
            ) : null}

            <div
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '100px',
                    background: 'linear-gradient(to top, black, transparent)',
                    pointerEvents: 'none',
                    zIndex: 11,
                }}
            />
        </div>
    );
};

export default BuyAStarGrid;
