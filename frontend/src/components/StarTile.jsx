import React, { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

const getPreviewPalette = (category) => {
    if (!category) {
        return { core: '#fff6de', glow: '#ffe6a8', rim: '#fffdf7' };
    }
    if (category.includes('Blue')) {
        return { core: '#8fd4ff', glow: '#4ca8ff', rim: '#eef8ff' };
    }
    if (category.includes('White')) {
        return { core: '#f4fbff', glow: '#b9dfff', rim: '#ffffff' };
    }
    if (category.includes('Red Giant')) {
        return { core: '#ffc38f', glow: '#ff8c57', rim: '#fff0df' };
    }
    if (category.includes('Red Dwarf')) {
        return { core: '#ffae8e', glow: '#ff6f4d', rim: '#ffe3d8' };
    }
    return { core: '#ffe08b', glow: '#ffbf47', rim: '#fff7d6' };
};

const StarTilePreview = ({ star }) => {
    const palette = useMemo(() => getPreviewPalette(star.category), [star.category]);

    return (
        <svg
            viewBox="0 0 220 110"
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            aria-hidden="true"
        >
            <defs>
                <radialGradient id={`star-core-${star.id}`} cx="50%" cy="45%" r="52%">
                    <stop offset="0%" stopColor={palette.rim} />
                    <stop offset="34%" stopColor={palette.core} />
                    <stop offset="72%" stopColor={palette.glow} />
                    <stop offset="100%" stopColor={palette.glow} />
                </radialGradient>
                <radialGradient id={`star-halo-${star.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={palette.rim} stopOpacity="0.55" />
                    <stop offset="50%" stopColor={palette.glow} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`star-corona-${star.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="52%" stopColor={palette.glow} stopOpacity="0.22" />
                    <stop offset="78%" stopColor={palette.glow} stopOpacity="0.08" />
                    <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
                </radialGradient>
                <filter id={`star-blur-${star.id}`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="8" />
                </filter>
                <filter id={`star-corona-blur-${star.id}`} x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="3.5" />
                </filter>
                <filter id={`star-core-blur-${star.id}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="0.65" />
                </filter>
            </defs>

            <ellipse
                cx="110"
                cy="55"
                rx="44"
                ry="44"
                fill={`url(#star-halo-${star.id})`}
                filter={`url(#star-blur-${star.id})`}
            />
            <g filter={`url(#star-corona-blur-${star.id})`} opacity="0.9">
                <path
                    d="M110 18
                       C118 24, 126 22, 132 30
                       C140 39, 141 51, 137 60
                       C132 70, 137 79, 128 86
                       C120 92, 113 95, 110 92
                       C107 95, 99 92, 92 86
                       C83 79, 88 70, 83 60
                       C79 51, 80 39, 88 30
                       C94 22, 102 24, 110 18 Z"
                    fill={`url(#star-corona-${star.id})`}
                />
                <path
                    d="M110 21
                       C114 15, 120 14, 123 22
                       C126 29, 135 30, 137 39
                       C139 47, 146 49, 143 57
                       C140 65, 145 72, 138 77
                       C132 82, 130 90, 121 88
                       C114 86, 110 93, 103 88
                       C94 90, 88 82, 82 77
                       C75 72, 80 65, 77 57
                       C74 49, 81 47, 83 39
                       C85 30, 94 29, 97 22
                       C100 14, 106 15, 110 21 Z"
                    fill="none"
                    stroke={palette.glow}
                    strokeOpacity="0.22"
                    strokeWidth="3"
                />
            </g>
            <circle
                cx="110"
                cy="55"
                r="28.5"
                fill={`url(#star-core-${star.id})`}
                filter={`url(#star-core-blur-${star.id})`}
            />
            <ellipse
                cx="103"
                cy="47"
                rx="9"
                ry="6"
                fill={palette.rim}
                fillOpacity="0.18"
                transform="rotate(-18 103 47)"
            />
        </svg>
    );
};

const statusPill = (isClaimed) => ({
    padding: '7px 12px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 700,
    border: `1px solid ${isClaimed ? 'rgba(255,255,255,0.12)' : 'rgba(255,126,43,0.28)'}`,
    background: isClaimed ? 'rgba(255,255,255,0.05)' : 'rgba(255,106,0,0.12)',
    color: isClaimed ? '#c3c3cb' : '#ff9c63',
});

const formatDistance = (distance) =>
    Number(distance).toLocaleString(undefined, {
        maximumFractionDigits: 1,
    });

const StarTile = ({ star, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isClaimed = star.is_bought;
    const displayName = star.common_name || star.display_name || star.scientific_name;
    const secondaryName = star.common_name && star.scientific_name ? star.scientific_name : null;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'linear-gradient(180deg, rgba(20,20,30,0.86) 0%, rgba(15,15,24,0.94) 100%)',
                border: `1px solid ${isHovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '18px',
                padding: '18px',
                cursor: 'default',
                transition: 'all 0.28s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
                transform: isHovered ? 'translateY(-4px)' : 'none',
                boxShadow: isHovered ? '0 20px 40px rgba(0,0,0,0.38), 0 0 18px rgba(255,255,255,0.05)' : '0 8px 20px rgba(0,0,0,0.25)',
            }}
        >
            <div
                style={{
                    height: '100px',
                    background: 'rgba(0,0,0,0.45)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.08), transparent 58%)',
                    }}
                />
                <StarTilePreview star={star} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: '1.18rem',
                            color: 'white',
                            fontFamily: 'serif',
                            lineHeight: 1.1,
                            wordBreak: 'break-word',
                        }}
                    >
                        {displayName}
                    </h3>
                    {secondaryName && (
                        <div
                            style={{
                                color: '#8e8e9c',
                                fontSize: '0.78rem',
                                marginTop: '6px',
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                            }}
                        >
                            {secondaryName}
                        </div>
                    )}
                </div>

                <div style={statusPill(isClaimed)}>{isClaimed ? 'Claimed' : 'Unclaimed'}</div>
            </div>

                <div style={{ display: 'grid', gap: '7px', color: '#b6b6be' }}>
                    <div style={{ fontSize: '0.95rem' }}>
                        {star.category}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#9595a0', fontSize: '0.88rem' }}>
                        <span>{formatDistance(star.distance_ly)} ly</span>
                        <span>{star.constellation || 'Unknown constellation'}</span>
                    </div>
                </div>

            {isClaimed ? (
                <div
                    style={{
                        background: 'rgba(255,255,255,0.035)',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        fontSize: '0.84rem',
                        color: '#b0b0b8',
                        lineHeight: 1.5,
                    }}
                >
                    <strong style={{ color: '#d9d9df', fontWeight: 600 }}>Owner</strong>
                    <div>{star.owner_name || 'Recorded owner'}</div>
                </div>
            ) : (
                <div
                    style={{
                        background: 'rgba(255,106,0,0.05)',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,126,43,0.08)',
                        fontSize: '0.84rem',
                        color: '#ffb287',
                        lineHeight: 1.5,
                    }}
                >
                    Available to register.
                </div>
            )}

            <button
                onClick={() => onClick(star)}
                style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    marginTop: 'auto',
                }}
            >
                <Eye size={18} /> View
            </button>
        </div>
    );
};

export default StarTile;
