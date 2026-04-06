import React, { useMemo, useRef, useState } from 'react';

const formatDateLabel = (value) => {
    try {
        return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
        return '';
    }
};

const buildPath = (points, width, height, padding) => {
    if (!points.length) {
        return {
            path: '',
            coordinates: [],
            minValue: 0,
            maxValue: 0,
            spread: 1,
            domainMin: 0,
            domainMax: 1,
        };
    }

    const values = points.map((point) => point.model_value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = Math.max(maxValue - minValue, maxValue * 0.08, 1);
    const domainMin = minValue - spread * 0.15;
    const domainMax = domainMin + spread * 1.3;
    const left = padding.left;
    const top = padding.top;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const coordinates = points.map((point, index) => {
        const x = left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
        const normalized = (point.model_value - domainMin) / (spread * 1.3);
        const y = top + innerHeight - (normalized * innerHeight);
        return { x, y };
    });

    return {
        path: coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '),
        coordinates,
        minValue,
        maxValue,
        spread,
        domainMin,
        domainMax,
    };
};

const StarValueChart = ({ points = [], currencyFormatter }) => {
    const width = 760;
    const height = 240;
    const padding = { top: 16, right: 10, bottom: 34, left: 62 };
    const svgRef = useRef(null);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const chartGeometry = useMemo(() => buildPath(points, width, height, padding), [points]);
    const latestCoordinate = chartGeometry.coordinates[chartGeometry.coordinates.length - 1] || null;
    const latestPoint = points[points.length - 1] || null;
    const firstPoint = points[0] || null;
    const movement = latestPoint && firstPoint
        ? ((latestPoint.model_value - firstPoint.model_value) / Math.max(firstPoint.model_value, 0.01)) * 100
        : 0;
    const gridRatios = [0.1, 0.35, 0.6, 0.85];
    const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] || null : null;
    const hoveredCoordinate = hoveredIndex !== null ? chartGeometry.coordinates[hoveredIndex] || null : null;
    const activePoint = hoveredPoint || latestPoint;
    const activeCoordinate = hoveredCoordinate || latestCoordinate;

    const handlePointerMove = (event) => {
        if (!chartGeometry.coordinates.length || !svgRef.current) {
            return;
        }
        const bounds = svgRef.current.getBoundingClientRect();
        if (!bounds.width) {
            return;
        }
        const relativeX = ((event.clientX - bounds.left) / bounds.width) * width;
        let nearestIndex = 0;
        let nearestDistance = Math.abs(chartGeometry.coordinates[0].x - relativeX);

        for (let index = 1; index < chartGeometry.coordinates.length; index += 1) {
            const distance = Math.abs(chartGeometry.coordinates[index].x - relativeX);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        }

        setHoveredIndex(nearestIndex);
    };

    const handlePointerLeave = () => {
        setHoveredIndex(null);
    };

    if (!points.length) {
        return (
            <div
                style={{
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '28px',
                    color: '#a7a7b3',
                    lineHeight: 1.7,
                }}
            >
                Predicted price history will appear here once valuation snapshots have been recorded.
            </div>
        );
    }

    return (
        <div
            style={{
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%)',
                padding: '22px 22px 18px',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
                <div>
                    <div style={{ color: '#ff8a4d', fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>
                        Predicted Price
                    </div>
                    <div style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>
                        {currencyFormatter(latestPoint.model_value)}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: movement >= 0 ? '#8ee3a5' : '#ff8f8f', fontWeight: 'bold', marginBottom: '8px' }}>
                        {movement >= 0 ? '+' : ''}{movement.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div style={{ position: 'relative' }}>
                {hoveredPoint && hoveredCoordinate ? (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${(hoveredCoordinate.x / width) * 100}%`,
                            top: `${Math.max(8, ((hoveredCoordinate.y / height) * 100) - 28)}%`,
                            transform: 'translate(-50%, -100%)',
                            pointerEvents: 'none',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(12,12,16,0.84)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                            textAlign: 'center',
                            minWidth: '118px',
                        }}
                    >
                        <div style={{ color: '#f4f4f6', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '2px' }}>
                            {currencyFormatter(hoveredPoint.model_value)}
                        </div>
                        <div style={{ color: '#8f8f99', fontSize: '0.78rem' }}>
                            {formatDateLabel(hoveredPoint.valuation_date)}
                        </div>
                    </div>
                ) : null}

                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    style={{ width: '100%', height: '220px', display: 'block', overflow: 'visible' }}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                >
                    {gridRatios.map((ratio) => {
                        const y = padding.top + (height - padding.top - padding.bottom) * ratio;
                        const value = chartGeometry.domainMax - ((y - padding.top) / (height - padding.top - padding.bottom)) * (chartGeometry.domainMax - chartGeometry.domainMin);
                        return (
                            <g key={ratio}>
                                <line
                                    x1={padding.left}
                                    x2={width - padding.right}
                                    y1={y}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={padding.left - 12}
                                    y={y + 4}
                                    fill="rgba(193,193,204,0.72)"
                                    fontSize="11"
                                    textAnchor="end"
                                >
                                    {currencyFormatter(value)}
                                </text>
                            </g>
                        );
                    })}
                    {hoveredCoordinate ? (
                        <line
                            x1={hoveredCoordinate.x}
                            x2={hoveredCoordinate.x}
                            y1={padding.top}
                            y2={height - padding.bottom}
                            stroke="rgba(255,255,255,0.22)"
                            strokeWidth="1.5"
                            strokeDasharray="4 6"
                        />
                    ) : null}
                    <path
                        d={chartGeometry.path}
                        fill="none"
                        stroke="#ff6d2f"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {activePoint && activeCoordinate ? (
                        <circle
                            cx={activeCoordinate.x}
                            cy={activeCoordinate.y}
                            r="6"
                            fill="#ffffff"
                            stroke="#ff6d2f"
                            strokeWidth="3"
                        />
                    ) : null}
                    <rect
                        x={padding.left}
                        y={padding.top}
                        width={width - padding.left - padding.right}
                        height={height - padding.top - padding.bottom}
                        fill="transparent"
                    />
                    <text x={padding.left} y={height - 8} fill="#7f7f8b" fontSize="13">
                        {formatDateLabel(firstPoint?.valuation_date)}
                    </text>
                    <text x={width - padding.right} y={height - 8} fill="#7f7f8b" fontSize="13" textAnchor="end">
                        {formatDateLabel(latestPoint?.valuation_date)}
                    </text>
                </svg>
            </div>
        </div>
    );
};

export default StarValueChart;
