import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DetailedStar from './DetailedStar';
import { ArrowLeft, CheckCircle2, FileText, ShoppingCart, Loader2, Truck } from 'lucide-react';
import { createCheckoutSession, fetchCheckoutOptions, fetchStarById } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import EmbeddedStripeCheckout from './EmbeddedStripeCheckout';
import { getColorFamily, getSpectralDisplay } from '../utils/starAppearance';

const formatMaybeNumber = (value, digits = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }
    return value.toFixed(digits);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const OBSERVATORY_LAYOUT_STORAGE_KEY = 'aster-atlas-observatory-layout-v4';
const OBSERVATORY_STAR_STORAGE_KEY = 'aster-atlas-observatory-star-v3';
const PORTRAIT_MODAL_LAYOUT_STORAGE_KEY = 'aster-atlas-portrait-observatory-layout-v1';

const DEFAULT_OBSERVATORY_LAYOUT = {
    luminosity: { x: 58.33906709080848, y: 6.604467782439489, w: 25 },
    colorIndex: { x: 9.008640277418875, y: 6.775370620039024, w: 19 },
    brightness: { x: -7.61635047890375, y: 30.899018090559807, w: 22 },
    structure: { x: 88.440343323451, y: 27.60312752456954, w: 24 },
    distance: { x: -11.780185315675183, y: 66.47198157391507, w: 37 },
    spectral: { x: 79.64559787963336, y: 67.28651475178394, w: 30 },
    sky: { x: 62.586934266805876, y: 84.01409555412454, w: 24 },
    age: { x: 8.708767406889518, y: 90.26137105670475, w: 44 },
};

const DEFAULT_STAR_LAYOUT = { x: 49.40831495923624, y: 51.24214362086634 };
const RESPONSIVE_STAR_LAYOUT = { x: 54, y: 44 };
const CENTERED_STAR_LAYOUT = { x: 50, y: 50 };
const RESPONSIVE_OBSERVATORY_LAYOUT = {
    luminosity: { x: 74, y: 5, w: 22 },
    colorIndex: { x: 5, y: 10, w: 18 },
    brightness: { x: 3, y: 33, w: 20 },
    structure: { x: 76, y: 40, w: 21 },
    distance: { x: 5, y: 64, w: 28 },
    spectral: { x: 68, y: 71, w: 29 },
    sky: { x: 76, y: 84, w: 20 },
    age: { x: 20, y: 86, w: 38 },
};

const PORTRAIT_MODAL_OBSERVATORY_LAYOUT = {
    luminosity: { x: 65.34950545533519, y: -6.632800052589477, w: 30 },
    colorIndex: { x: 8.964837280886005, y: -5.036846047422556, w: 27 },
    brightness: { x: -2.767976565417732, y: 24.720987918404216, w: 29 },
    structure: { x: 77.24235341905597, y: 24.615078609396125, w: 31 },
    distance: { x: -7.150652659090182, y: 65.10517217376498, w: 37 },
    spectral: { x: 72.97175480255889, y: 64.13165247120703, w: 34 },
    age: { x: -0.1683212108562051, y: 91.16154710933846, w: 52 },
    sky: { x: 64.84032914730666, y: 86.98791492117088, w: 28 },
};

const OBSERVATORY_MODULE_HEIGHTS = {
    luminosity: 238,
    colorIndex: 118,
    brightness: 176,
    structure: 238,
    distance: 118,
    spectral: 142,
    sky: 202,
    age: 118,
};

const inputStyle = {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '15px',
    borderRadius: '10px',
    border: '1px solid rgba(245,239,226,0.14)',
    background: 'rgba(7,10,17,0.76)',
    color: 'white',
    fontSize: '1rem',
};

const sanitizeObservatoryLayout = (value, defaultsMap = DEFAULT_OBSERVATORY_LAYOUT) => {
    const next = {};

    for (const [key, defaults] of Object.entries(defaultsMap)) {
        const candidate = value?.[key];
        next[key] = {
            x: typeof candidate?.x === 'number' && Number.isFinite(candidate.x) ? candidate.x : defaults.x,
            y: typeof candidate?.y === 'number' && Number.isFinite(candidate.y) ? candidate.y : defaults.y,
            w: defaults.w,
        };
    }

    return next;
};

const sanitizeStarLayout = (value, defaults = DEFAULT_STAR_LAYOUT) => ({
    x: typeof value?.x === 'number' && Number.isFinite(value.x) ? value.x : defaults.x,
    y: typeof value?.y === 'number' && Number.isFinite(value.y) ? value.y : defaults.y,
});

const TIMEZONE_TO_COUNTRY = {
    'Europe/London': 'GB',
    'Europe/Dublin': 'IE',
    'Europe/Paris': 'FR',
    'Europe/Berlin': 'DE',
    'Europe/Madrid': 'ES',
    'Europe/Rome': 'IT',
    'Europe/Amsterdam': 'NL',
    'Europe/Brussels': 'BE',
    'Europe/Vienna': 'AT',
    'Europe/Lisbon': 'PT',
    'Europe/Helsinki': 'FI',
    'Europe/Athens': 'GR',
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Copenhagen': 'DK',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Bucharest': 'RO',
    'Europe/Budapest': 'HU',
    'Europe/Zurich': 'CH',
    'Europe/Sofia': 'BG',
    'Europe/Bratislava': 'SK',
    'Europe/Ljubljana': 'SI',
    'Europe/Zagreb': 'HR',
    'Europe/Riga': 'LV',
    'Europe/Vilnius': 'LT',
    'Europe/Tallinn': 'EE',
    'Europe/Luxembourg': 'LU',
    'Europe/Malta': 'MT',
    'Europe/Nicosia': 'CY',
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'America/Phoenix': 'US',
    'America/Anchorage': 'US',
    'Pacific/Honolulu': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Edmonton': 'CA',
    'America/Winnipeg': 'CA',
    'America/Halifax': 'CA',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
    'Asia/Tokyo': 'JP',
    'Asia/Singapore': 'SG',
    'Asia/Hong_Kong': 'HK',
    'Asia/Dubai': 'AE',
    'Asia/Jerusalem': 'IL',
    'Asia/Kolkata': 'IN',
    'Asia/Shanghai': 'CN',
    'Asia/Riyadh': 'SA',
    'Africa/Johannesburg': 'ZA',
    'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR',
    'Europe/Istanbul': 'TR',
};

const detectCountryCode = () => {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone && TIMEZONE_TO_COUNTRY[timeZone]) {
            return TIMEZONE_TO_COUNTRY[timeZone];
        }
    } catch {
        // Ignore timezone detection failures and fall back to locale parsing.
    }

    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const locale of locales) {
        try {
            const parsed = new Intl.Locale(locale);
            if (parsed.region) {
                return parsed.region.toUpperCase();
            }
        } catch {
            const match = locale?.match(/[-_]([A-Za-z]{2})$/);
            if (match?.[1]) {
                return match[1].toUpperCase();
            }
        }
    }
    return 'GB';
};

const formatMoney = (amount, currency) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: (currency || 'gbp').toUpperCase(),
    }).format(amount);

const formatCompact = (value, digits = 1) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }

    return new Intl.NumberFormat('en-GB', {
        notation: 'compact',
        maximumFractionDigits: digits,
    }).format(value);
};

const getGaiaIdentifier = (star) => {
    if (star?.gaia_source_id) {
        return `Gaia DR3 ${star.gaia_source_id}`;
    }
    if (star?.source_catalog === 'Gaia DR3' && star?.source_id) {
        return `Gaia DR3 ${star.source_id}`;
    }
    if (star?.source_id) {
        return `${star.source_catalog || 'Source'} ${star.source_id}`;
    }
    return star?.catalog_id || null;
};

const getPercentileSubtitle = (star, componentKey, labelPrefix = 'Catalog percentile') => {
    const percentile = star?.valuation_debug?.coolness?.components?.[componentKey]?.local_percentile;
    if (typeof percentile !== 'number' || Number.isNaN(percentile)) {
        return null;
    }

    return `${labelPrefix} - ${Math.round(percentile * 100)}th`;
};

const getSpectralBandKey = (star, spectralDisplay) => {
    const spectralValue = `${spectralDisplay?.value || star?.spectral_type || ''}`.trim().toUpperCase();
    const firstLetter = spectralValue[0];
    if (['O', 'B', 'A', 'F', 'G', 'K', 'M'].includes(firstLetter)) {
        return firstLetter;
    }

    const colorFamily = getColorFamily(star);
    const fallbackMap = {
        Blue: 'O',
        'Blue-White': 'B',
        White: 'A',
        'Yellow-White': 'F',
        Yellow: 'G',
        Orange: 'K',
        Red: 'M',
    };
    return fallbackMap[colorFamily] || 'G';
};

const formatCoordinate = (value, positiveLabel, negativeLabel) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }
    const direction = value >= 0 ? positiveLabel : negativeLabel;
    return `${Math.abs(value).toFixed(1)} deg ${direction}`;
};

const buildPriceSignatureFactors = (star) => {
    const missingMetrics = Array.isArray(star?.valuation_missing_metrics) ? star.valuation_missing_metrics.length : 0;
    const visibilityValue = typeof star?.apparent_magnitude === 'number'
        ? `Apparent magnitude ${star.apparent_magnitude.toFixed(2)}`
        : typeof star?.absolute_magnitude === 'number'
            ? `Absolute magnitude ${star.absolute_magnitude.toFixed(2)}`
            : 'Brightness profile available';
    const positionParts = [];
    if (star?.constellation) {
        positionParts.push(star.constellation);
    }
    const declination = formatCoordinate(star?.dec_degrees, 'N', 'S');
    if (declination) {
        positionParts.push(declination);
    }

    const distinctivenessParts = [];
    if (star?.spectral_type) {
        distinctivenessParts.push(star.spectral_type);
    }
    if (star?.variable_designation) {
        distinctivenessParts.push('variable catalogued');
    }
    if (star?.non_single_star) {
        distinctivenessParts.push('multiple-star profile');
    }

    const physicalParts = [];
    if (typeof star?.luminosity === 'number' && Number.isFinite(star.luminosity)) {
        physicalParts.push(`${formatCompact(star.luminosity, star.luminosity > 999 ? 1 : 2)}x solar output`);
    }
    if (typeof star?.radius_flame === 'number' && Number.isFinite(star.radius_flame)) {
        physicalParts.push(`${star.radius_flame.toFixed(star.radius_flame > 10 ? 1 : 2)} solar radii`);
    }
    if (typeof star?.mass_flame === 'number' && Number.isFinite(star.mass_flame)) {
        physicalParts.push(`${star.mass_flame.toFixed(star.mass_flame > 10 ? 1 : 2)} solar masses`);
    }

    return [
        {
            label: 'Catalogue quality',
            value: star?.category || 'Catalogued star',
            detail: star?.gaia_source_id
                ? `Anchored to Gaia DR3 source ${star.gaia_source_id}.`
                : 'Anchored to the published catalogue record for this star.',
        },
        {
            label: 'Brightness and visibility',
            value: visibilityValue,
            detail: 'Visible brightness and intrinsic light output help shape today\'s registration price.',
        },
        {
            label: 'Distinctiveness',
            value: distinctivenessParts.length ? distinctivenessParts.join(', ') : 'Spectral character recorded',
            detail: 'Colour band, classification, and unusual features contribute to the star\'s individual signature.',
        },
        {
            label: 'Celestial position',
            value: positionParts.length ? positionParts.join(' | ') : 'Sky position recorded',
            detail: typeof star?.distance_ly === 'number'
                ? `${star.distance_ly.toFixed(2)} light years from Earth.`
                : 'Placement within the night sky helps round out the profile.',
        },
        {
            label: 'Physical profile',
            value: physicalParts.length ? physicalParts.join(' | ') : 'Measured stellar characteristics',
            detail: 'Where available, mass, radius, temperature, and luminosity add depth to the pricing signature.',
        },
        {
            label: 'Data confidence',
            value: missingMetrics === 0 ? 'Complete signature' : missingMetrics <= 2 ? 'Strong signature' : 'Developing signature',
            detail: missingMetrics === 0
                ? 'The current catalogue snapshot includes the full set of core pricing inputs.'
                : `${missingMetrics} supporting input${missingMetrics === 1 ? '' : 's'} remain unavailable, so the price leans more heavily on the confirmed record.`,
        },
    ];
};

const buildPriceRefreshLabel = (star, status) => {
    if (star?.model_value_last_calculated_at) {
        return `Refreshed ${new Date(star.model_value_last_calculated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (status === 'loading') {
        return 'Refreshing price signature...';
    }
    if (star?.valuation_eligible) {
        return 'Awaiting the next catalogue refresh';
    }
    return 'Built from the best available catalogue record';
};

const instrumentShellStyle = {
    position: 'relative',
    borderRadius: '26px',
    border: '1px solid rgba(150,179,255,0.12)',
    background: 'linear-gradient(180deg, rgba(9,13,22,0.42) 0%, rgba(7,10,18,0.18) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 42px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
    clipPath: 'polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px))',
};

const moduleLabelStyle = {
    color: '#ff8a4d',
    fontSize: '0.68rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: '8px',
};

const getInstrumentFrameStyle = (variant = 'panel', hovered = false, accent = '#ff8a4d') => {
    const accentGlow = accent === '#ff8a4d' ? 'rgba(255,138,77,0.18)' : 'rgba(130,168,255,0.18)';

    const variants = {
        panel: {
            borderRadius: '24px',
            background: 'linear-gradient(180deg, rgba(8,11,20,0.34) 0%, rgba(7,10,18,0.14) 100%)',
            border: '1px solid rgba(150,179,255,0.1)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 42px rgba(0,0,0,0.1)',
        },
        hero: {
            borderRadius: '28px',
            background: 'linear-gradient(180deg, rgba(10,14,24,0.48) 0%, rgba(7,10,18,0.16) 100%)',
            border: '1px solid rgba(255,177,122,0.16)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 56px rgba(0,0,0,0.14)',
        },
        floating: {
            borderRadius: '22px',
            background: 'linear-gradient(180deg, rgba(9,13,22,0.22) 0%, rgba(8,11,18,0.08) 100%)',
            border: '1px solid rgba(150,179,255,0.08)',
            boxShadow: '0 16px 36px rgba(0,0,0,0.08)',
        },
        rail: {
            borderRadius: '22px',
            background: 'linear-gradient(180deg, rgba(8,11,20,0.3) 0%, rgba(6,9,16,0.1) 100%)',
            border: '1px solid rgba(150,179,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        },
        band: {
            borderRadius: '24px',
            background: 'linear-gradient(180deg, rgba(9,13,22,0.28) 0%, rgba(7,10,18,0.1) 100%)',
            border: '1px solid rgba(150,179,255,0.08)',
            boxShadow: '0 14px 30px rgba(0,0,0,0.08)',
        },
        map: {
            borderRadius: '22px',
            background: 'linear-gradient(180deg, rgba(9,13,22,0.34) 0%, rgba(7,10,18,0.14) 100%)',
            border: '1px solid rgba(150,179,255,0.1)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 38px rgba(0,0,0,0.1)',
        },
    };

    const base = variants[variant] || variants.panel;

    return {
        ...instrumentShellStyle,
        ...base,
        transform: hovered ? 'translateY(-2px)' : 'none',
        borderColor: hovered ? 'rgba(255,186,132,0.28)' : base.border.match(/rgba\([^)]+\)/)?.[0] || base.borderColor,
        boxShadow: hovered
            ? `${base.boxShadow}, 0 0 0 1px rgba(255,186,132,0.12) inset, 0 20px 40px ${accentGlow}`
            : base.boxShadow,
    };
};

const ObservatoryModule = ({ title, subtitle, children, style, variant = 'panel', hovered = false, accent = '#ff8a4d', titleStyle, contentStyle }) => (
    <div
        style={{
            ...getInstrumentFrameStyle(variant, hovered, accent),
            padding: '18px 18px 16px',
            transition: 'border-color 0.2s ease, transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
            pointerEvents: 'auto',
            ...style,
        }}
    >
        <div
            style={{
                position: 'absolute',
                left: '18px',
                right: '18px',
                top: '14px',
                height: '1px',
                background: 'linear-gradient(90deg, rgba(130,161,255,0.28) 0%, rgba(255,255,255,0.03) 44%, rgba(255,151,80,0.18) 100%)',
                opacity: 0.8,
            }}
        />
        <div
            style={{
                position: 'absolute',
                right: '18px',
                top: '18px',
                width: '34px',
                height: '34px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '0 18px 0 0',
                opacity: 0.8,
            }}
        />
        <div style={{ ...moduleLabelStyle, ...titleStyle }}>{title}</div>
        {subtitle ? (
            <div style={{ color: '#8f94ad', fontSize: '0.84rem', marginBottom: '14px' }}>{subtitle}</div>
        ) : null}
        <div style={contentStyle}>{children}</div>
    </div>
);

const CircularGauge = ({ value, max = 1, label, subtitle, accent = '#ff8a4d', hovered = false }) => {
    const normalized = Math.min(1, Math.max(0, value / max));
    const circumference = 2 * Math.PI * 56;
    const dashOffset = circumference * (1 - normalized);

    return (
        <ObservatoryModule
            title="Luminosity"
            subtitle={subtitle}
            variant="hero"
            accent={accent}
            hovered={hovered}
            style={{
                padding: '22px 22px 18px',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(96px, 0.82fr) minmax(0, 1fr)',
                    alignItems: 'center',
                    gap: '14px',
                    minWidth: 0,
                }}
            >
                <svg width="150" height="150" viewBox="0 0 150 150" style={{ width: '100%', maxWidth: '136px', height: 'auto', minWidth: 0 }}>
                    <defs>
                        <linearGradient id="luminosityGauge" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fff4d1" />
                            <stop offset="100%" stopColor={accent} />
                        </linearGradient>
                    </defs>
                    <circle cx="75" cy="75" r="56" stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" />
                    <circle
                        cx="75"
                        cy="75"
                        r="56"
                        stroke="url(#luminosityGauge)"
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 75 75)"
                    />
                    <circle cx="75" cy="75" r="44" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" />
                    <text x="75" y="68" fill="#f6f3eb" textAnchor="middle" style={{ fontSize: '1.45rem', fontWeight: 'bold' }}>
                        {label}
                    </text>
                    <text x="75" y="90" fill="#8f94ad" textAnchor="middle" style={{ fontSize: '0.78rem' }}>
                        L☉
                    </text>
                </svg>
                <div style={{ display: 'grid', gap: '10px', minWidth: 0 }}>
                    <div style={{ color: '#f3f4f8', fontSize: 'clamp(0.78rem, 0.82vw, 0.98rem)', lineHeight: 1.25, fontWeight: 'bold', overflowWrap: 'break-word' }}>
                        {label}x the Sun
                    </div>
                    <div style={{ color: '#8f94ad', lineHeight: 1.45, fontSize: 'clamp(0.7rem, 0.72vw, 0.86rem)', overflowWrap: 'break-word' }}>
                        Total radiative output relative to Solar luminosity.
                    </div>
                </div>
            </div>
        </ObservatoryModule>
    );
};

const ComparisonModule = ({ radius, mass, radiusSubtitle, massSubtitle, hovered = false }) => {
    const radiusRatio = Math.max(0.24, Math.min(1.9, Math.log10(1 + (radius || 0.2)) + 0.5));
    const massRatio = Math.max(0.04, Math.min(1, (mass || 0) / 12));

    return (
        <ObservatoryModule
            title="Structure"
            subtitle="Radius and mass relative to the Sun"
            variant="panel"
            hovered={hovered}
            style={{ padding: '18px 20px 16px' }}
        >
            <div style={{ display: 'grid', gap: '18px' }}>
                {typeof radius === 'number' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.24)', background: 'rgba(255,208,118,0.12)', position: 'absolute' }} />
                            <div
                                style={{
                                    width: `${Math.min(102, 34 * radiusRatio)}px`,
                                    height: `${Math.min(102, 34 * radiusRatio)}px`,
                                    borderRadius: '999px',
                                    border: '1px solid rgba(255,158,92,0.42)',
                                    background: 'radial-gradient(circle, rgba(255,181,88,0.26) 0%, rgba(255,120,52,0.08) 70%, transparent 100%)',
                                    position: 'absolute',
                                }}
                            />
                        </div>
                        <div>
                            <div style={{ color: '#f3f4f8', fontWeight: 'bold', marginBottom: '6px' }}>
                                Radius · {formatMaybeNumber(radius, radius > 10 ? 1 : 2)} R☉
                            </div>
                            <div style={{ color: '#8f94ad', fontSize: '0.86rem', lineHeight: 1.6 }}>
                                {radiusSubtitle || 'Compared visually against a Solar-radius reference circle.'}
                            </div>
                        </div>
                    </div>
                ) : null}

                {typeof mass === 'number' ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#f3f4f8', fontWeight: 'bold' }}>
                            <span>Mass</span>
                            <span>{formatMaybeNumber(mass, mass > 10 ? 1 : 2)} M☉</span>
                        </div>
                        <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '8px' }}>
                            <div
                                style={{
                                    width: `${massRatio * 100}%`,
                                    height: '100%',
                                    borderRadius: '999px',
                                    background: 'linear-gradient(90deg, rgba(130,196,255,0.72) 0%, rgba(255,160,98,0.86) 100%)',
                                    boxShadow: '0 0 18px rgba(255,163,92,0.18)',
                                }}
                            />
                        </div>
                        <div style={{ color: '#8f94ad', fontSize: '0.84rem' }}>
                            {massSubtitle || 'Mass compared against a high-mass stellar scale for context.'}
                        </div>
                    </div>
                ) : null}
            </div>
        </ObservatoryModule>
    );
};

const DistanceModule = ({ distanceLy, hovered = false }) => {
    const clampedDistance = typeof distanceLy === 'number' ? Math.max(0, distanceLy) : null;
    const scaleMax = 100000;
    const ratio = clampedDistance === null ? 0 : Math.min(1, clampedDistance / scaleMax);

    return (
        <ObservatoryModule
            title="Distance"
            subtitle={clampedDistance !== null ? `${formatCompact(clampedDistance, clampedDistance > 999 ? 1 : 2)} light years from Earth` : null}
            variant="rail"
            hovered={hovered}
            style={{
                padding: '16px 22px 16px',
            }}
        >
            <div style={{ position: 'relative', paddingTop: '20px' }}>
                <div style={{ height: '2px', background: 'linear-gradient(90deg, rgba(112,156,255,0.44) 0%, rgba(255,146,84,0.4) 100%)' }} />
                <div
                    style={{
                        position: 'absolute',
                        left: `${ratio * 100}%`,
                        top: '12px',
                        transform: 'translateX(-50%)',
                        width: '14px',
                        height: '14px',
                        borderRadius: '999px',
                        background: '#fff0d6',
                        boxShadow: '0 0 0 6px rgba(255,140,68,0.16), 0 0 24px rgba(255,196,118,0.34)',
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px', color: '#8f94ad', fontSize: '0.8rem' }}>
                    <span>Earth</span>
                    <span>Milky Way scale · 100k ly</span>
                </div>
            </div>
        </ObservatoryModule>
    );
};

const SpectralBandModule = ({ activeBand, subtitle, hovered = false }) => {
    const bands = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
    const colors = {
        O: '#74b6ff',
        B: '#95d3ff',
        A: '#e7f4ff',
        F: '#fff4da',
        G: '#ffe38d',
        K: '#ffba70',
        M: '#ff7c64',
    };

    return (
        <ObservatoryModule title="Spectral Family" subtitle={subtitle} variant="band" hovered={hovered} style={{ padding: '16px 18px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
                {bands.map((band) => {
                    const isActive = band === activeBand;
                    return (
                        <div
                            key={band}
                            style={{
                                padding: '14px 0',
                                borderRadius: '14px',
                                textAlign: 'center',
                                border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                background: isActive ? `linear-gradient(180deg, ${colors[band]}22 0%, rgba(255,255,255,0.02) 100%)` : 'rgba(255,255,255,0.02)',
                                boxShadow: isActive ? `0 0 0 1px ${colors[band]}44 inset, 0 0 22px ${colors[band]}22` : 'none',
                            }}
                        >
                            <div style={{ color: colors[band], fontWeight: 'bold', fontSize: '1rem' }}>{band}</div>
                        </div>
                    );
                })}
            </div>
        </ObservatoryModule>
    );
};

const ColorIndexModule = ({ colorIndex, hovered = false }) => {
    const min = -0.3;
    const max = 2.3;
    const ratio = typeof colorIndex === 'number' ? clamp((colorIndex - min) / (max - min), 0, 1) : null;

    return (
        <ObservatoryModule title="Colour Index" subtitle={typeof colorIndex === 'number' ? `B−V index · ${formatMaybeNumber(colorIndex, 3)}` : 'Colour-index reading unavailable'} variant="floating" hovered={hovered} style={{ padding: '14px 16px 12px' }}>
            <div style={{ position: 'relative', padding: '16px 0 8px' }}>
                <div
                    style={{
                        height: '14px',
                        borderRadius: '999px',
                        background: 'linear-gradient(90deg, #81b7ff 0%, #edf6ff 26%, #ffe58d 56%, #ffb36d 77%, #ff7864 100%)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                    }}
                />
                {ratio !== null ? (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${ratio * 100}%`,
                            top: '8px',
                            transform: 'translateX(-50%)',
                            width: '18px',
                            height: '30px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.22)',
                            background: 'rgba(7,9,16,0.76)',
                            boxShadow: '0 0 18px rgba(255,255,255,0.08)',
                        }}
                    />
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: '#8f94ad', fontSize: '0.78rem' }}>
                    <span>Blue</span>
                    <span>Red</span>
                </div>
            </div>
        </ObservatoryModule>
    );
};

const BrightnessModule = ({ apparentMagnitude, absoluteMagnitude, hovered = false }) => {
    const normalizeMagnitude = (value, min = -10, max = 18) => {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return null;
        }
        return 1 - clamp((value - min) / (max - min), 0, 1);
    };

    const apparentFill = normalizeMagnitude(apparentMagnitude);
    const absoluteFill = normalizeMagnitude(absoluteMagnitude, -12, 10);

    return (
        <ObservatoryModule
            title="Brightness"
            subtitle="Observed brightness compared with intrinsic brightness"
            variant="floating"
            hovered={hovered}
            style={{ padding: '14px 16px 12px' }}
        >
            <div style={{ display: 'grid', gap: '16px' }}>
                {typeof apparentMagnitude === 'number' ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#f3f4f8' }}>
                            <span>Apparent</span>
                            <span>{formatMaybeNumber(apparentMagnitude, 2)} mag</span>
                        </div>
                        <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${(apparentFill || 0) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #7ab5ff 0%, #fff0c2 100%)' }} />
                        </div>
                    </div>
                ) : null}
                {typeof absoluteMagnitude === 'number' ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#f3f4f8' }}>
                            <span>Absolute</span>
                            <span>{formatMaybeNumber(absoluteMagnitude, 2)} mag</span>
                        </div>
                        <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${(absoluteFill || 0) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ff9957 0%, #fff2b2 100%)' }} />
                        </div>
                    </div>
                ) : null}
            </div>
        </ObservatoryModule>
    );
};

const SkyPositionModule = ({ star, hovered = false }) => {
    const hasCoordinates = typeof star?.ra_degrees === 'number' && typeof star?.dec_degrees === 'number';
    const x = hasCoordinates ? (star.ra_degrees / 360) * 100 : 50;
    const y = hasCoordinates ? 100 - (((star.dec_degrees + 90) / 180) * 100) : 50;

    return (
        <ObservatoryModule title="Sky Position" subtitle={star?.constellation ? `Constellation · ${star.constellation}` : 'Equatorial coordinate panel'} variant="map" hovered={hovered} style={{ padding: '14px 16px 14px' }}>
            <div style={{ position: 'relative', height: '148px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, rgba(102,127,186,0.14) 0%, rgba(6,8,14,0.7) 70%)' }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    {[20, 40, 60, 80].map((line) => (
                        <g key={line}>
                            <line x1={line} y1="0" x2={line} y2="100" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
                            <line x1="0" y1={line} x2="100" y2={line} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
                        </g>
                    ))}
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.12)" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.12)" />
                    {hasCoordinates ? (
                        <>
                            <circle cx={x} cy={y} r="2.8" fill="#fff2d5" />
                            <circle cx={x} cy={y} r="7.2" fill="none" stroke="rgba(255,150,84,0.48)" />
                        </>
                    ) : null}
                </svg>
                <div style={{ position: 'absolute', left: '14px', bottom: '12px', color: '#8f94ad', fontSize: '0.78rem' }}>
                    {hasCoordinates ? `RA ${formatMaybeNumber(star.ra_degrees, 2)}° · Dec ${formatMaybeNumber(star.dec_degrees, 2)}°` : 'Precise sky coordinates unavailable'}
                </div>
            </div>
        </ObservatoryModule>
    );
};

const AgeTimelineModule = ({ age, hovered = false }) => {
    const ratio = typeof age === 'number' ? clamp(age / 13.8, 0, 1) : null;

    return (
        <ObservatoryModule
            title="Age"
            subtitle={typeof age === 'number' ? `${formatMaybeNumber(age, age > 10 ? 1 : 2)} billion years` : 'Stellar age unavailable'}
            variant="rail"
            hovered={hovered}
            style={{ padding: '14px 18px 14px' }}
        >
            <div style={{ position: 'relative', paddingTop: '10px' }}>
                <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div
                        style={{
                            width: `${(ratio || 0) * 100}%`,
                            height: '100%',
                            borderRadius: '999px',
                            background: 'linear-gradient(90deg, rgba(123,193,255,0.72) 0%, rgba(255,162,89,0.9) 55%, rgba(255,86,86,0.88) 100%)',
                        }}
                    />
                </div>
                {ratio !== null ? (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${ratio * 100}%`,
                            top: '2px',
                            transform: 'translateX(-50%)',
                            width: '12px',
                            height: '20px',
                            borderRadius: '999px',
                            background: '#fff0cf',
                            boxShadow: '0 0 20px rgba(255,192,112,0.28)',
                        }}
                    />
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', color: '#8f94ad', fontSize: '0.78rem' }}>
                    <span>0 Gyr</span>
                    <span>Cosmic age · 13.8 Gyr</span>
                </div>
            </div>
        </ObservatoryModule>
    );
};

const StatusModule = ({ star }) => {
    const variability = star?.phot_variable_flag && !['NOT_AVAILABLE', 'CONSTANT', 'N', 'FALSE', '0', 'NO'].includes(String(star.phot_variable_flag).toUpperCase());
    const binaryProbability = typeof star?.classprob_dsc_combmod_binarystar === 'number'
        ? Math.round(star.classprob_dsc_combmod_binarystar * 100)
        : null;
    const binaryKnown = binaryProbability !== null ? binaryProbability >= 50 : Boolean(star?.non_single_star);

    return (
        <ObservatoryModule
            title="System Status"
            subtitle="Observed behaviour and system architecture"
            style={{ padding: '16px 18px 14px' }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: '#8f94ad', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '10px' }}>Variability</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f3f4f8', fontWeight: 'bold' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: variability ? '#ff8a4d' : '#8d93aa', boxShadow: variability ? '0 0 12px rgba(255,138,77,0.42)' : 'none' }} />
                        {variability ? (star.best_class_name || 'Variable') : 'Steady'}
                    </div>
                </div>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: '#8f94ad', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '10px' }}>Multiplicity</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f3f4f8', fontWeight: 'bold' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: binaryKnown ? '#8ed6ff' : '#8d93aa', boxShadow: binaryKnown ? '0 0 12px rgba(142,214,255,0.36)' : 'none' }} />
                        {binaryProbability !== null ? `${binaryProbability}% binary likelihood` : binaryKnown ? 'Multi-star signal' : 'No strong binary signal'}
                    </div>
                </div>
            </div>
        </ObservatoryModule>
    );
};

const ObservatoryBackdrop = ({ starLayout, hoveredInstrument }) => {
    const starLeft = `${starLayout.x}%`;
    const starTop = `${starLayout.y}%`;
    const haloBoost = hoveredInstrument === 'luminosity' ? 1 : 0;
    const spectralBoost = hoveredInstrument === 'spectral' ? 1 : 0;

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
                style={{
                    position: 'absolute',
                    left: starLeft,
                    top: starTop,
                    width: '720px',
                    height: '720px',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '999px',
                    background: `radial-gradient(circle, rgba(255,220,170,${0.08 + haloBoost * 0.08}) 0%, rgba(255,154,94,${0.06 + haloBoost * 0.06}) 26%, rgba(96,134,255,${0.05 + spectralBoost * 0.07}) 46%, rgba(0,0,0,0) 74%)`,
                    filter: 'blur(18px)',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    left: starLeft,
                    top: `calc(${starTop} + 112px)`,
                    width: '440px',
                    height: '120px',
                    transform: 'translateX(-50%)',
                    background: 'radial-gradient(ellipse at center, rgba(255,188,120,0.08) 0%, rgba(255,128,64,0.03) 44%, rgba(0,0,0,0) 72%)',
                    filter: 'blur(10px)',
                }}
            />
        </div>
    );
};

const StarViewer = ({ star, onBack, onSuccess, onViewInGalaxy }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingUser } = useAuth();
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1720,
        height: typeof window !== 'undefined' ? window.innerHeight : 980,
    }));
    const detectedCountryCode = useMemo(() => detectCountryCode(), []);
    const [registrationType, setRegistrationType] = useState('self');
    const [ownerName, setOwnerName] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [dedication, setDedication] = useState('');
    const [giftMessage, setGiftMessage] = useState('');
    const [certificateType, setCertificateType] = useState('digital');
    const [checkoutOptions, setCheckoutOptions] = useState([]);
    const [selectedCountryCode, setSelectedCountryCode] = useState(detectedCountryCode || 'GB');
    const [showCountrySelector, setShowCountrySelector] = useState(!detectedCountryCode);
    const [checkoutOptionsStatus, setCheckoutOptionsStatus] = useState('loading');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [starDetail, setStarDetail] = useState(star);
    const [starDetailStatus, setStarDetailStatus] = useState('idle');
    const [layoutEditMode, setLayoutEditMode] = useState(false);
    const [isObservatoryModalOpen, setIsObservatoryModalOpen] = useState(false);
    const [isObservatoryModalClosing, setIsObservatoryModalClosing] = useState(false);
    const [hoveredInstrument, setHoveredInstrument] = useState(null);
    const [observatoryLayout, setObservatoryLayout] = useState(() => {
        try {
            const raw = window.localStorage.getItem(OBSERVATORY_LAYOUT_STORAGE_KEY);
            return raw ? sanitizeObservatoryLayout(JSON.parse(raw)) : DEFAULT_OBSERVATORY_LAYOUT;
        } catch {
            return DEFAULT_OBSERVATORY_LAYOUT;
        }
    });
    const [starLayout, setStarLayout] = useState(() => {
        try {
            const raw = window.localStorage.getItem(OBSERVATORY_STAR_STORAGE_KEY);
            return raw ? sanitizeStarLayout(JSON.parse(raw)) : DEFAULT_STAR_LAYOUT;
        } catch {
            return DEFAULT_STAR_LAYOUT;
        }
    });
    const [portraitModalLayout, setPortraitModalLayout] = useState(() => {
        try {
            const raw = window.localStorage.getItem(PORTRAIT_MODAL_LAYOUT_STORAGE_KEY);
            return raw ? sanitizeObservatoryLayout(JSON.parse(raw), PORTRAIT_MODAL_OBSERVATORY_LAYOUT) : PORTRAIT_MODAL_OBSERVATORY_LAYOUT;
        } catch {
            return PORTRAIT_MODAL_OBSERVATORY_LAYOUT;
        }
    });
    const observatoryCanvasRef = useRef(null);
    const observatoryPaneRef = useRef(null);
    const dragStateRef = useRef(null);
    const modalCloseTimeoutRef = useRef(null);
    const [observatoryPaneSize, setObservatoryPaneSize] = useState({ width: 0, height: 0 });

    const regionNames = useMemo(
        () => (typeof Intl.DisplayNames !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null),
        []
    );
    const activeStar = starDetail || star;
    const spectralDisplay = useMemo(() => getSpectralDisplay(activeStar), [activeStar]);
    const gaiaIdentifier = useMemo(() => getGaiaIdentifier(activeStar), [activeStar]);
    const spectralBand = useMemo(() => getSpectralBandKey(activeStar, spectralDisplay), [activeStar, spectralDisplay]);
    const luminosityPercentile = useMemo(
        () => getPercentileSubtitle(activeStar, 'luminosity_outlier'),
        [activeStar]
    );
    const radiusPercentile = useMemo(
        () => getPercentileSubtitle(activeStar, 'radius_outlier'),
        [activeStar]
    );
    const massPercentile = useMemo(
        () => getPercentileSubtitle(activeStar, 'mass_outlier'),
        [activeStar]
    );
    const priceSignatureFactors = useMemo(() => buildPriceSignatureFactors(activeStar), [activeStar]);
    const priceRefreshLabel = useMemo(() => buildPriceRefreshLabel(activeStar, starDetailStatus), [activeStar, starDetailStatus]);
    const isPortraitLayout = viewportSize.width < viewportSize.height;
    const isLandscapeLayout = viewportSize.width >= 1180;
    const usesObservatoryModal = isPortraitLayout || !isLandscapeLayout;
    const isPortraitObservatoryOpen = usesObservatoryModal && isObservatoryModalOpen;
    const canArrangeObservatory = isLandscapeLayout && !usesObservatoryModal;
    const leftUiScale = clamp(Math.min(viewportSize.width / 1680, viewportSize.height / 980), 0.82, 1.04);
    const observatoryDesignWidth = 980;
    const observatoryDesignHeight = 920;
    const observatoryResponsiveWidth = 1260;
    const activeObservatoryResponsiveWidth = isPortraitObservatoryOpen ? 1215 : observatoryResponsiveWidth;
    const observatoryStarBoxSize = 645;
    const activeObservatoryLayout = isPortraitObservatoryOpen
        ? portraitModalLayout
        : canArrangeObservatory
            ? observatoryLayout
            : RESPONSIVE_OBSERVATORY_LAYOUT;
    const activeStarLayout = isPortraitObservatoryOpen || canArrangeObservatory ? CENTERED_STAR_LAYOUT : RESPONSIVE_STAR_LAYOUT;
    const canEditActiveObservatory = canArrangeObservatory || isPortraitObservatoryOpen;
    const scalePx = useCallback((value) => `${Math.round(value * leftUiScale)}px`, [leftUiScale]);
    const scaleRem = useCallback((value) => `${(value * leftUiScale).toFixed(3)}rem`, [leftUiScale]);
    const pageTopPadding = Math.round(18 * leftUiScale);
    const pageBottomPadding = Math.round(24 * leftUiScale);
    const pageViewportHeight = `calc(100vh - ${pageTopPadding + pageBottomPadding}px)`;
    const hasLuminosity = typeof activeStar.luminosity === 'number';
    const hasColorIndex = typeof activeStar.color_index === 'number' || typeof activeStar.bp_rp === 'number';
    const hasBrightness = typeof activeStar.apparent_magnitude === 'number' || typeof activeStar.absolute_magnitude === 'number';
    const hasSkyPosition = Boolean(activeStar.constellation || (typeof activeStar.ra_degrees === 'number' && typeof activeStar.dec_degrees === 'number'));
    const hasAge = typeof activeStar.age_flame === 'number';
    const hasDistance = typeof activeStar.distance_ly === 'number';
    const hasSpectral = Boolean(spectralDisplay);

    const visibleInstrumentKeys = useMemo(
        () => ([
            hasLuminosity && 'luminosity',
            'structure',
            hasDistance && 'distance',
            hasSpectral && 'spectral',
            hasColorIndex && 'colorIndex',
            hasBrightness && 'brightness',
            hasSkyPosition && 'sky',
            hasAge && 'age',
        ].filter(Boolean)),
        [hasAge, hasBrightness, hasColorIndex, hasDistance, hasLuminosity, hasSkyPosition, hasSpectral]
    );

    const observatorySceneTransform = useMemo(() => {
        const paneWidth = usesObservatoryModal ? viewportSize.width : observatoryPaneSize.width || observatoryDesignWidth;
        const paneHeight = usesObservatoryModal ? viewportSize.height : observatoryPaneSize.height || observatoryDesignHeight;
        const viewportPaddingX = 24;
        const viewportPaddingY = 28;
        const fitOverscanX = observatoryDesignWidth * 0.08;
        const fitOverscanY = observatoryDesignHeight * 0.08;
        const bounds = {
            minX: (activeStarLayout.x / 100) * observatoryDesignWidth - observatoryStarBoxSize / 2,
            minY: (activeStarLayout.y / 100) * observatoryDesignHeight - observatoryStarBoxSize / 2,
            maxX: (activeStarLayout.x / 100) * observatoryDesignWidth + observatoryStarBoxSize / 2,
            maxY: (activeStarLayout.y / 100) * observatoryDesignHeight + observatoryStarBoxSize / 2,
        };

        visibleInstrumentKeys.forEach((key) => {
            const layout = activeObservatoryLayout[key];
            if (!layout) {
                return;
            }

            const x = (layout.x / 100) * observatoryDesignWidth;
            const y = (layout.y / 100) * observatoryDesignHeight;
            const width = (layout.w / 100) * observatoryDesignWidth;
            const height = OBSERVATORY_MODULE_HEIGHTS[key] || 160;
            const fitX = clamp(x, -fitOverscanX, observatoryDesignWidth - width + fitOverscanX);
            const fitY = clamp(y, -fitOverscanY, observatoryDesignHeight - height + fitOverscanY);

            bounds.minX = Math.min(bounds.minX, fitX);
            bounds.minY = Math.min(bounds.minY, fitY);
            bounds.maxX = Math.max(bounds.maxX, fitX + width);
            bounds.maxY = Math.max(bounds.maxY, fitY + height);
        });

        const widthResponsiveScale = paneWidth / activeObservatoryResponsiveWidth;
        const fitScale = Math.min(
            (paneWidth - viewportPaddingX * 2) / Math.max(1, bounds.maxX - bounds.minX),
            (paneHeight - viewportPaddingY * 2) / Math.max(1, bounds.maxY - bounds.minY),
            widthResponsiveScale
        );

        const scale = Number.isFinite(fitScale) ? Math.max(0.1, fitScale) : 1;
        const starSceneX = (activeStarLayout.x / 100) * observatoryDesignWidth;
        const starSceneY = (activeStarLayout.y / 100) * observatoryDesignHeight;
        const desiredStarX = (activeStarLayout.x / 100) * paneWidth;
        const desiredStarY = (activeStarLayout.y / 100) * paneHeight;
        const minOffsetX = viewportPaddingX - bounds.minX * scale;
        const maxOffsetX = paneWidth - viewportPaddingX - bounds.maxX * scale;
        const minOffsetY = viewportPaddingY - bounds.minY * scale;
        const maxOffsetY = paneHeight - viewportPaddingY - bounds.maxY * scale;
        const offsetX = clamp(desiredStarX - starSceneX * scale, minOffsetX, maxOffsetX);
        const offsetY = clamp(desiredStarY - starSceneY * scale, minOffsetY, maxOffsetY);

        return {
            scale,
            offsetX,
            offsetY,
        };
    }, [activeObservatoryLayout, activeObservatoryResponsiveWidth, activeStarLayout, observatoryPaneSize.height, observatoryPaneSize.width, observatoryStarBoxSize, usesObservatoryModal, viewportSize.height, viewportSize.width, visibleInstrumentKeys]);

    const centeredStarSceneLayout = useMemo(() => {
        const paneWidth = usesObservatoryModal ? viewportSize.width : observatoryPaneSize.width || observatoryDesignWidth;
        const paneHeight = usesObservatoryModal ? viewportSize.height : observatoryPaneSize.height || observatoryDesignHeight;
        const scale = observatorySceneTransform.scale || 1;
        const sceneX = ((activeStarLayout.x / 100) * paneWidth - observatorySceneTransform.offsetX) / scale;
        const sceneY = ((activeStarLayout.y / 100) * paneHeight - observatorySceneTransform.offsetY) / scale;

        return {
            x: (sceneX / observatoryDesignWidth) * 100,
            y: (sceneY / observatoryDesignHeight) * 100,
        };
    }, [
        observatoryDesignHeight,
        observatoryDesignWidth,
        activeStarLayout,
        observatoryPaneSize.height,
        observatoryPaneSize.width,
        observatorySceneTransform.offsetX,
        observatorySceneTransform.offsetY,
        observatorySceneTransform.scale,
        usesObservatoryModal,
        viewportSize.height,
        viewportSize.width,
    ]);

    const centeredStarDisplaySize = isPortraitObservatoryOpen
        ? Math.min(viewportSize.width * 0.76, viewportSize.height * 0.48, 640)
        : observatoryStarBoxSize * observatorySceneTransform.scale;

    const observatoryConnectors = useMemo(() => {
        return visibleInstrumentKeys.map((key) => {
            const layout = activeObservatoryLayout[key];
            if (!layout) {
                return null;
            }

            const starX = centeredStarSceneLayout.x;
            const starY = centeredStarSceneLayout.y;
            const moduleOnLeft = layout.x + layout.w / 2 < starX;
            const startX = moduleOnLeft ? layout.x + layout.w : layout.x;
            const startY = layout.y + 8;
            const dx = starX - startX;
            const dy = starY - startY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return {
                key,
                startX,
                startY,
                length,
                angle,
            };
        }).filter(Boolean);
    }, [activeObservatoryLayout, centeredStarSceneLayout, visibleInstrumentKeys]);

    useEffect(() => {
        if (canEditActiveObservatory) {
            return;
        }
        setLayoutEditMode(false);
    }, [canEditActiveObservatory]);

    useEffect(() => {
        if (usesObservatoryModal) {
            return;
        }

        setIsObservatoryModalOpen(false);
        setIsObservatoryModalClosing(false);
    }, [usesObservatoryModal]);

    useEffect(() => () => {
        if (modalCloseTimeoutRef.current) {
            window.clearTimeout(modalCloseTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(OBSERVATORY_LAYOUT_STORAGE_KEY, JSON.stringify(observatoryLayout));
        } catch {
            // Ignore storage failures.
        }
    }, [observatoryLayout]);

    useEffect(() => {
        try {
            window.localStorage.setItem(PORTRAIT_MODAL_LAYOUT_STORAGE_KEY, JSON.stringify(portraitModalLayout));
        } catch {
            // Ignore storage failures.
        }
    }, [portraitModalLayout]);

    useEffect(() => {
        const handleResize = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const node = observatoryPaneRef.current;
        if (!node) {
            return undefined;
        }

        const updateSize = () => {
            setObservatoryPaneSize({
                width: node.clientWidth,
                height: node.clientHeight,
            });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }

        const observer = new ResizeObserver(() => updateSize());
        observer.observe(node);

        return () => observer.disconnect();
    }, [isLandscapeLayout, isObservatoryModalOpen, usesObservatoryModal]);

    useEffect(() => {
        try {
            window.localStorage.setItem(OBSERVATORY_STAR_STORAGE_KEY, JSON.stringify(starLayout));
        } catch {
            // Ignore storage failures.
        }
    }, [starLayout]);

    useEffect(() => {
        if (!layoutEditMode || !canEditActiveObservatory) {
            return undefined;
        }

        const handlePointerMove = (event) => {
            const state = dragStateRef.current;
            const bounds = observatoryCanvasRef.current?.getBoundingClientRect();

            if (!state || !bounds?.width || !bounds?.height) {
                return;
            }

            const deltaXPct = ((event.clientX - state.startX) / bounds.width) * 100;
            const deltaYPct = ((event.clientY - state.startY) / bounds.height) * 100;

            if (state.kind === 'star') {
                const nextLayout = {
                    x: state.startLayout.x + deltaXPct,
                    y: state.startLayout.y + deltaYPct,
                };
                setStarLayout(nextLayout);
                return;
            }

            const width = state.startLayout.w;

            const updateLayout = (current) => ({
                ...current,
                [state.key]: {
                    ...current[state.key],
                    x: state.startLayout.x + deltaXPct,
                    y: state.startLayout.y + deltaYPct,
                    w: width,
                },
            });

            if (state.scope === 'portrait-modal') {
                setPortraitModalLayout(updateLayout);
            } else {
                setObservatoryLayout(updateLayout);
            }
        };

        const handlePointerUp = () => {
            dragStateRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [canEditActiveObservatory, layoutEditMode]);

    useEffect(() => {
        let isActive = true;
        setStarDetail(star);
        setStarDetailStatus('loading');

        fetchStarById(star.id)
            .then((data) => {
                if (!isActive) {
                    return;
                }
                setStarDetail(data);
                setStarDetailStatus('ready');
            })
            .catch((detailError) => {
                console.error(detailError);
                if (!isActive) {
                    return;
                }
                setStarDetailStatus('error');
            });

        return () => {
            isActive = false;
        };
    }, [star.id]);

    useEffect(() => {
        const loadCheckoutOptions = async () => {
            setCheckoutOptionsStatus('loading');
            try {
                const response = await fetchCheckoutOptions(selectedCountryCode, star.id);
                const nextOptions = response.options || [];
                const nextCountryCode = response.country_code || selectedCountryCode;
                const nextSupportedCountries = Array.from(new Set([nextCountryCode, ...(response.supported_countries || [])]));

                setCheckoutOptions(nextOptions);
                setCertificateType((currentCertificateType) => (
                    nextOptions.some((option) => option.code === currentCertificateType)
                        ? currentCertificateType
                        : (response.default_certificate_type || nextOptions[0]?.code || 'digital')
                ));
                setSelectedCountryCode(nextCountryCode);
                setShowCountrySelector(!detectedCountryCode || !nextSupportedCountries.includes(detectedCountryCode));
                setPricingCurrency(response.currency || 'gbp');
                setStarPrice(response.star_price || 0);
                setSupportedCountries(nextSupportedCountries);
                setError(null);
                setCheckoutOptionsStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setCheckoutOptionsStatus('error');
            }
        };

        loadCheckoutOptions();
    }, [detectedCountryCode, selectedCountryCode, star.id]);

    const [pricingCurrency, setPricingCurrency] = useState('gbp');
    const [starPrice, setStarPrice] = useState(parseFloat(star.price));
    const [supportedCountries, setSupportedCountries] = useState([]);

    const selectedCertificateOption = useMemo(
        () => checkoutOptions.find((option) => option.code === certificateType) || checkoutOptions[0] || null,
        [certificateType, checkoutOptions]
    );
    const basePrice = starPrice;
    const certificatePrice = selectedCertificateOption?.price || 0;
    const shippingPrice = selectedCertificateOption?.shipping_amount || 0;
    const total = basePrice + certificatePrice + shippingPrice;

    const handlePurchase = async () => {
        if (!isAuthenticated) {
            navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
            return;
        }

        if (!ownerName.trim()) {
            setError('Please enter the registered display name.');
            return;
        }
        if (registrationType === 'gift' && !recipientName.trim()) {
            setError('Please enter the recipient name for this gift.');
            return;
        }
        if (!acceptedTerms) {
            setError('Please accept the Terms & Conditions before purchasing.');
            return;
        }
        if (!acceptedPrivacy) {
            setError('Please accept the Privacy Notice before purchasing.');
            return;
        }
        if (!selectedCertificateOption) {
            setError('Certificate options are still loading. Please try again in a moment.');
            return;
        }

        setError(null);
        setIsCheckoutOpen(true);
    };

    const createStripeSession = useCallback(async () => {
        setProcessing(true);
        try {
            return await createCheckoutSession({
                starId: star.id,
                registrationType,
                ownerName,
                recipientName,
                recipientEmail,
                dedication,
                giftMessage,
                certificateType,
                countryCode: selectedCountryCode,
                acceptedTerms,
                acceptedPrivacy,
            });
        } finally {
            setProcessing(false);
        }
    }, [acceptedPrivacy, acceptedTerms, certificateType, dedication, giftMessage, ownerName, recipientEmail, recipientName, registrationType, selectedCountryCode, star.id]);

    const handleCheckoutComplete = useCallback((sessionId) => {
        if (!sessionId) {
            setError('Stripe returned without a checkout session identifier.');
            return;
        }

        navigate(`/checkout/complete?session_id=${encodeURIComponent(sessionId)}`);
    }, [navigate]);

    const handleCheckoutError = useCallback((message) => {
        setError(message);
        setIsCheckoutOpen(false);
    }, []);

    const handleOpenObservatoryModal = useCallback(() => {
        if (modalCloseTimeoutRef.current) {
            window.clearTimeout(modalCloseTimeoutRef.current);
            modalCloseTimeoutRef.current = null;
        }
        setIsObservatoryModalClosing(false);
        setIsObservatoryModalOpen(true);
    }, []);

    const handleCloseObservatoryModal = useCallback(() => {
        setIsObservatoryModalClosing(true);
        modalCloseTimeoutRef.current = window.setTimeout(() => {
            setIsObservatoryModalOpen(false);
            setIsObservatoryModalClosing(false);
            modalCloseTimeoutRef.current = null;
        }, 320);
    }, []);

    const handleResetObservatoryLayout = useCallback(() => {
        if (isPortraitObservatoryOpen) {
            setPortraitModalLayout(PORTRAIT_MODAL_OBSERVATORY_LAYOUT);
            return;
        }
        setObservatoryLayout(DEFAULT_OBSERVATORY_LAYOUT);
        setStarLayout(DEFAULT_STAR_LAYOUT);
    }, [isPortraitObservatoryOpen]);

    const handleStartModuleDrag = useCallback((key, event) => {
        if (!layoutEditMode || !canEditActiveObservatory) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        dragStateRef.current = {
            kind: 'module',
            scope: isPortraitObservatoryOpen ? 'portrait-modal' : 'landscape',
            key,
            startX: event.clientX,
            startY: event.clientY,
            startLayout: activeObservatoryLayout[key],
        };
    }, [activeObservatoryLayout, canEditActiveObservatory, isPortraitObservatoryOpen, layoutEditMode]);

    const handleStartStarDrag = useCallback((event) => {
        if (!layoutEditMode || !canEditActiveObservatory) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        dragStateRef.current = {
            kind: 'star',
            scope: 'landscape',
            startX: event.clientX,
            startY: event.clientY,
            startLayout: activeStarLayout,
        };
    }, [activeStarLayout, canEditActiveObservatory, layoutEditMode]);

    const renderObservatoryModule = useCallback((key, children) => {
        const layout = activeObservatoryLayout[key];
        if (!layout) {
            return null;
        }

        const isHovered = hoveredInstrument === key;

        return (
            <div
                key={key}
                onPointerDown={(event) => handleStartModuleDrag(key, event)}
                onPointerEnter={() => setHoveredInstrument(key)}
                onPointerLeave={() => setHoveredInstrument((current) => (current === key ? null : current))}
                style={{
                    position: 'absolute',
                    left: `${layout.x}%`,
                    top: `${layout.y}%`,
                    width: `${layout.w}%`,
                    pointerEvents: 'auto',
                    cursor: layoutEditMode && canEditActiveObservatory ? 'grab' : 'default',
                    zIndex: layoutEditMode && canEditActiveObservatory ? 6 : isHovered ? 4 : 2,
                    touchAction: 'none',
                    transition: 'z-index 0.18s ease',
                }}
            >
                {layoutEditMode && canEditActiveObservatory ? (
                    <div
                        style={{
                            position: 'absolute',
                            top: '-12px',
                            left: '12px',
                            padding: '5px 10px',
                            borderRadius: '999px',
                            background: 'rgba(255,122,64,0.92)',
                            color: '#fff8f0',
                            fontSize: '0.68rem',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontWeight: 'bold',
                            boxShadow: '0 8px 18px rgba(255,77,0,0.18)',
                        }}
                    >
                        Drag
                    </div>
                ) : null}
                {React.isValidElement(children) ? React.cloneElement(children, { hovered: isHovered }) : children}
            </div>
        );
    }, [activeObservatoryLayout, canEditActiveObservatory, handleStartModuleDrag, hoveredInstrument, layoutEditMode]);

    return (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000', overflow: 'hidden' }}>
            <style>
                {`
                    @keyframes asterObservatoryModalOpen {
                        from {
                            opacity: 0;
                            transform: translate3d(24vw, -24vh, 0) scale(0.18);
                            border-radius: 30px;
                        }
                        to {
                            opacity: 1;
                            transform: translate3d(0, 0, 0) scale(1);
                            border-radius: 0;
                        }
                    }

                    @keyframes asterObservatoryModalClose {
                        from {
                            opacity: 1;
                            transform: translate3d(0, 0, 0) scale(1);
                            border-radius: 0;
                        }
                        to {
                            opacity: 0;
                            transform: translate3d(24vw, -24vh, 0) scale(0.18);
                            border-radius: 30px;
                        }
                    }
                `}
            </style>
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
                <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
            </Canvas>

            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    height: pageViewportHeight,
                    padding: `${scalePx(18)} clamp(16px, 2vw, 34px) ${scalePx(24)}`,
                    display: 'grid',
                    gridTemplateColumns: !usesObservatoryModal && isLandscapeLayout ? 'minmax(0, 0.8fr) minmax(0, 1.2fr)' : '1fr',
                    gap: scalePx(!usesObservatoryModal && isLandscapeLayout ? 26 : 20),
                    alignItems: 'stretch',
                }}
            >
                <div
                    style={{
                        minWidth: 0,
                        minHeight: 0,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        fontSize: `${(16 * leftUiScale).toFixed(2)}px`,
                        borderRadius: scalePx(28),
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.62) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(8px)',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ flex: 1, overflowY: 'auto', padding: `${scalePx(18)} ${scalePx(18)} ${scalePx(24)}` }}>
                        <div style={{ display: 'grid', gap: scalePx(22) }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    onClick={onBack}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: scalePx(8),
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: 'white',
                                        padding: `${scalePx(10)} ${scalePx(18)}`,
                                        borderRadius: scalePx(28),
                                        cursor: 'pointer',
                                        backdropFilter: 'blur(10px)',
                                        fontSize: scaleRem(0.92),
                                    }}
                                >
                                    <ArrowLeft size={16 * leftUiScale} /> Back
                                </button>
                            </div>

                            <div>
                        <div style={{ marginBottom: '24px' }}>
                            <h1 style={{ fontSize: scaleRem(3.06), marginBottom: scalePx(6), fontFamily: 'serif', color: 'white', lineHeight: 0.96 }}>
                                {activeStar.common_name || activeStar.scientific_name}
                            </h1>
                        </div>
                            </div>

                        {activeStar.is_bought ? (
                            <div
                                style={{
                                    background: 'linear-gradient(135deg, rgba(26,40,30,0.92) 0%, rgba(14,20,18,0.9) 100%)',
                                    border: '1px solid rgba(136,204,136,0.28)',
                                    padding: `${scalePx(24)} ${scalePx(24)} ${scalePx(22)}`,
                                    borderRadius: scalePx(22),
                                    color: 'white',
                                    marginBottom: scalePx(24),
                                    boxShadow: '0 16px 34px rgba(0,0,0,0.28)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ce29c', marginBottom: '10px', fontWeight: 'bold', letterSpacing: '0.04em' }}>
                                    <CheckCircle2 size={22} /> REGISTERED STAR
                                </div>
                                <div style={{ fontSize: '1.9rem', fontFamily: 'serif', marginBottom: '8px' }}>
                                    {activeStar.owner_name}
                                </div>
                                <div style={{ color: '#b7c6b8', lineHeight: 1.65, fontSize: '0.94rem', marginBottom: '14px' }}>
                                    This star is already registered and recorded in the Aster Atlas private registry.
                                </div>
                                <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', color: '#9aa89a', fontSize: '0.9rem' }}>
                                    <div>
                                            <span style={{ color: '#6f8a73', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                                                Registry State
                                            </span>
                                        Registered and preserved in Aster Atlas
                                    </div>
                                    {activeStar.purchase_date ? (
                                        <div>
                                            <span style={{ color: '#6f8a73', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                                                Registered since
                                            </span>
                                            {new Date(activeStar.purchase_date).toLocaleDateString('en-GB')}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    background: 'linear-gradient(135deg, rgba(255,77,0,0.18) 0%, rgba(30,18,12,0.88) 100%)',
                                    border: '1px solid rgba(255,122,64,0.32)',
                                    padding: `${scalePx(24)} ${scalePx(24)} ${scalePx(22)}`,
                                    borderRadius: scalePx(22),
                                    color: 'white',
                                    marginBottom: scalePx(24),
                                    boxShadow: '0 18px 40px rgba(255,77,0,0.12)',
                                }}
                            >
                                <div style={{ color: '#ffb08a', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', fontWeight: 'bold' }}>
                                    Registration
                                </div>
                                <div style={{ fontSize: '1.85rem', fontFamily: 'serif', marginBottom: '8px' }}>
                                    Create the first record
                                </div>
                                <div style={{ color: '#f0c2af', lineHeight: 1.65, fontSize: '0.97rem' }}>
                                    Register this star inside Aster Atlas and create the first private registry record for it.
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                background: 'rgba(18, 18, 24, 0.86)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: scalePx(22),
                                padding: scalePx(24),
                                marginBottom: scalePx(28),
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
                                <div>
                                    <div style={{ color: '#ff8a4d', fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>
                                        Registration price
                                    </div>
                                    <div style={{ color: 'white', fontSize: '1.45rem', fontWeight: 'bold' }}>
                                        A considered registration price for this star
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#8f8f99', fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        Registration price
                                    </div>
                                    <div style={{ color: 'white', fontSize: '1.95rem', fontWeight: 'bold', marginBottom: '6px' }}>
                                        {formatMoney(basePrice, pricingCurrency)}
                                    </div>
                                    <div style={{ color: '#8f8f99', fontSize: '0.88rem' }}>
                                        {priceRefreshLabel}
                                    </div>
                                </div>
                            </div>

                            <p style={{ color: '#b8b8c4', lineHeight: 1.7, fontSize: '0.96rem', margin: '0 0 18px 0' }}>
                                Each star receives a registration price shaped by its astronomical profile. The price remains visible, but the real focus is the lasting record, certificate, and star page you create around it.
                            </p>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '12px',
                                    marginBottom: '16px',
                                }}
                            >
                                {priceSignatureFactors.map((factor) => (
                                    <div
                                        key={factor.label}
                                        style={{
                                            borderRadius: scalePx(18),
                                            padding: scalePx(18),
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                                        }}
                                    >
                                        <div style={{ color: '#ffb08a', fontSize: '0.76rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>
                                            {factor.label}
                                        </div>
                                        <div style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold', lineHeight: 1.45, marginBottom: '8px' }}>
                                            {factor.value}
                                        </div>
                                        <div style={{ color: '#9ea0af', fontSize: '0.88rem', lineHeight: 1.65 }}>
                                            {factor.detail}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '16px',
                                    flexWrap: 'wrap',
                                    paddingTop: '14px',
                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                    color: '#8f8f99',
                                    fontSize: '0.88rem',
                                    lineHeight: 1.6,
                                }}
                            >
                                <span>This figure is the Aster Atlas registration price for today, designed to feel considered, transparent, and gift-worthy.</span>
                                <span>Certificate and delivery options are added separately during registration.</span>
                            </div>
                        </div>

                    {activeStar.is_bought ? null : (
                        <div
                            style={{
                                background: 'rgba(20, 20, 30, 0.8)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '30px',
                                borderRadius: '16px',
                                color: 'white',
                            }}
                        >
                            <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                                Register this star
                            </h2>

                            {error && (
                                <div style={{ color: '#ff6666', marginBottom: '15px', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ marginBottom: '25px' }}>
                                {showCountrySelector ? (
                                    <>
                                        <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                            Country
                                        </label>
                                        <select
                                            value={selectedCountryCode}
                                            onChange={(event) => setSelectedCountryCode(event.target.value)}
                                            style={{
                                                width: '100%',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                                padding: '15px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(0,0,0,0.5)',
                                                color: 'white',
                                                fontSize: '1rem',
                                                marginBottom: '16px',
                                            }}
                                        >
                                            {supportedCountries.map((countryCode) => (
                                                <option key={countryCode} value={countryCode}>
                                                    {regionNames?.of(countryCode) || countryCode}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                ) : null}
                                <div style={{ marginBottom: '18px' }}>
                                    <div style={{ color: '#ffb08a', fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '10px' }}>
                                        Step 2 · Who is this for?
                                    </div>
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {[
                                            { value: 'self', label: 'For myself', body: 'Attach the registration to your account as the current holder.' },
                                            { value: 'gift', label: 'For someone else', body: 'Prepare the gift now. The recipient can view it first and claim it later.' },
                                            { value: 'decide_later', label: 'I will decide later', body: 'Register it to your account for now and keep future gifting open.' },
                                        ].map((option) => {
                                            const isSelected = registrationType === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setRegistrationType(option.value)}
                                                    style={{
                                                        display: 'grid',
                                                        gap: '6px',
                                                        width: '100%',
                                                        padding: '16px',
                                                        borderRadius: '14px',
                                                        border: `1px solid ${isSelected ? 'var(--border-gold)' : 'rgba(255,255,255,0.1)'}`,
                                                        background: isSelected ? 'rgba(200,121,58,0.12)' : 'rgba(0,0,0,0.28)',
                                                        color: 'white',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <strong>{option.label}</strong>
                                                    <span style={{ color: '#b7b3ab', fontSize: '0.92rem', lineHeight: 1.6 }}>{option.body}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ color: '#ffb08a', fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '10px' }}>
                                    Step 3 · Registration details
                                </div>
                                <div style={{ display: 'grid', gap: '14px' }}>
                                    {registrationType === 'gift' ? (
                                        <>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                                    Recipient name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={recipientName}
                                                    onChange={(e) => setRecipientName(e.target.value)}
                                                    placeholder="e.g. Amelia"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                                    Recipient email (optional)
                                                </label>
                                                <input
                                                    type="email"
                                                    value={recipientEmail}
                                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                                    placeholder="For a later claim invitation"
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </>
                                    ) : null}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                            Registered display name
                                        </label>
                                        <input
                                            type="text"
                                            value={ownerName}
                                            onChange={(e) => setOwnerName(e.target.value)}
                                            placeholder={registrationType === 'gift' ? 'e.g. Amelia Rose' : 'e.g. John Doe'}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                            Dedication (optional)
                                        </label>
                                        <textarea
                                            value={dedication}
                                            onChange={(e) => setDedication(e.target.value)}
                                            rows={3}
                                            placeholder="A short dedication or why this star matters."
                                            style={{ ...inputStyle, resize: 'vertical', minHeight: '108px' }}
                                        />
                                    </div>
                                    {registrationType === 'gift' ? (
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                                Gift message (optional)
                                            </label>
                                            <textarea
                                                value={giftMessage}
                                                onChange={(e) => setGiftMessage(e.target.value)}
                                                rows={3}
                                                placeholder="A note for the recipient."
                                                style={{ ...inputStyle, resize: 'vertical', minHeight: '108px' }}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div style={{ marginBottom: '30px' }}>
                                <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '12px' }}>Certificate option</div>
                                {checkoutOptionsStatus === 'loading' ? (
                                    <div style={{ color: '#888' }}>Loading certificate options...</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {checkoutOptions.map((option) => {
                                            const isSelected = option.code === certificateType;
                                            return (
                                                <button
                                                    key={option.code}
                                                    type="button"
                                                    onClick={() => setCertificateType(option.code)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'space-between',
                                                        gap: '18px',
                                                        width: '100%',
                                                        padding: '16px',
                                                        borderRadius: '14px',
                                                        border: `1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                                        background: isSelected ? 'rgba(255, 77, 0, 0.1)' : 'rgba(0,0,0,0.3)',
                                                        color: 'white',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                                        {option.shipping_required ? (
                                                            <Truck color={isSelected ? 'var(--primary)' : '#888'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                        ) : (
                                                            <FileText color={isSelected ? 'var(--primary)' : '#888'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                        )}
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{option.label}</div>
                                                            <div style={{ fontSize: '0.86rem', color: '#9a9aa6', lineHeight: 1.6 }}>{option.description}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: isSelected ? 'white' : '#c9c9d2' }}>
                                                        {formatMoney(option.price, pricingCurrency)}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#aaa' }}>Registry record</span>
                                    <span style={{ color: 'white' }}>{formatMoney(basePrice, pricingCurrency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#aaa' }}>{selectedCertificateOption?.label || 'Certificate'}</span>
                                    <span style={{ color: 'white' }}>{formatMoney(certificatePrice, pricingCurrency)}</span>
                                </div>
                                {selectedCertificateOption?.shipping_required ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#aaa' }}>Shipping</span>
                                        <span style={{ color: 'white' }}>{formatMoney(shippingPrice, pricingCurrency)}</span>
                                    </div>
                                ) : null}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                    <span style={{ color: '#aaa' }}>Total to complete registration</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{formatMoney(total, pricingCurrency)}</span>
                                </div>
                            </div>

                            <div className="glass-card" style={{ padding: '18px 18px', marginBottom: '20px' }}>
                                <div className="eyebrow" style={{ marginBottom: '8px' }}>Step 4 · Preview</div>
                                <p className="muted-copy" style={{ margin: 0 }}>
                                    You are preparing a private Aster Atlas registry record for <strong style={{ color: 'var(--text-primary)' }}>{ownerName || 'this star'}</strong>
                                    {registrationType === 'gift' && recipientName ? `, intended for ${recipientName}` : ''}.
                                    {dedication ? ' The dedication will appear with the record when made public.' : ' You can return later to expand the public StarWiki page.'}
                                </p>
                            </div>

                            {!isCheckoutOpen ? (
                                <>
                                    <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#d7d7de', lineHeight: 1.6, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={acceptedTerms}
                                                onChange={(event) => setAcceptedTerms(event.target.checked)}
                                                style={{ marginTop: '3px' }}
                                            />
                                            <span>
                                                I accept the <Link to="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Terms &amp; Conditions</Link>.
                                            </span>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#d7d7de', lineHeight: 1.6, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={acceptedPrivacy}
                                                onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                                                style={{ marginTop: '3px' }}
                                            />
                                            <span>
                                                I accept the <Link to="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Privacy Notice</Link>.
                                            </span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handlePurchase}
                                        disabled={processing || isLoadingUser || checkoutOptionsStatus !== 'ready'}
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            fontSize: '1.1rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            borderRadius: '12px',
                                            border: 'none',
                                            cursor: (processing || isLoadingUser || checkoutOptionsStatus !== 'ready') ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            gap: '10px',
                                            opacity: (processing || isLoadingUser || checkoutOptionsStatus !== 'ready') ? 0.7 : 1,
                                            transition: 'all 0.2s',
                                            boxShadow: '0 10px 20px rgba(255,77,0,0.2)',
                                        }}
                                    >
                                        {processing ? <Loader2 className="spinner" size={20} /> : <ShoppingCart size={20} />}
                                        {processing ? 'Starting registration...' : isAuthenticated ? 'Complete Registration' : 'Sign in to continue'}
                                    </button>
                                    {!isAuthenticated ? (
                                        <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.85rem', marginTop: '14px' }}>
                                            You&apos;ll be redirected to sign in before saving this star to your account.
                                        </p>
                                    ) : null}
                                    <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', marginTop: '15px' }}>
                                        Secure payment via Stripe sandbox checkout. Aster Atlas remains a private registry built around real catalogued stars.
                                    </p>
                                </>
                            ) : (
                                <div style={{ display: 'grid', gap: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Secure payment</div>
                                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Complete your registration below using Stripe&apos;s sandbox checkout.</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsCheckoutOpen(false)}
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: '999px',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                            }}
                                        >
                                            Edit registration
                                        </button>
                                    </div>

                                    <div style={{ background: '#ffffff', borderRadius: '18px', overflow: 'hidden', padding: '8px' }}>
                                        <EmbeddedStripeCheckout
                                            createSession={createStripeSession}
                                            onComplete={handleCheckoutComplete}
                                            onError={handleCheckoutError}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                        </div>
                    </div>
                </div>

                {usesObservatoryModal && (!isObservatoryModalOpen || isObservatoryModalClosing) ? (
                    <div
                        style={{
                            position: 'fixed',
                            top: 'clamp(16px, 2.4vw, 28px)',
                            right: 'clamp(14px, 2.2vw, 24px)',
                            zIndex: 24,
                            width: 'clamp(142px, 28vw, 210px)',
                            maxWidth: 'calc(100vw - 28px)',
                            boxSizing: 'border-box',
                            borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: 'linear-gradient(180deg, rgba(12,15,24,0.88) 0%, rgba(5,8,14,0.72) 100%)',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(16px)',
                            overflow: 'hidden',
                        }}
                    >
                        <button
                            type="button"
                            onClick={handleOpenObservatoryModal}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                color: 'white',
                                cursor: 'pointer',
                                textAlign: 'left',
                                overflow: 'hidden',
                                boxSizing: 'border-box',
                            }}
                        >
                            <div style={{ position: 'relative', height: 'clamp(96px, 18vw, 132px)', overflow: 'hidden' }}>
                                <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
                                    <ambientLight intensity={0.2} />
                                    <pointLight position={[10, 5, 10]} intensity={1.4} />
                                    <pointLight position={[-10, -5, -10]} intensity={0.45} />
                                    <group scale={[1.33, 1.33, 1.33]}>
                                        <DetailedStar star={star} detailLevel="hero" />
                                    </group>
                                </Canvas>
                            </div>
                            <div style={{ padding: '0 14px 14px', display: 'grid', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ color: '#ff8a4d', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>
                                        Observatory
                                    </div>
                                    <div style={{ color: '#f6f3eb', fontSize: 'clamp(0.72rem, 2.4vw, 0.9rem)', fontWeight: 'bold', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                        {activeStar.common_name || activeStar.scientific_name}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        borderRadius: '999px',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        padding: '9px 12px',
                                        fontSize: '0.78rem',
                                        fontWeight: 'bold',
                                        letterSpacing: '0.04em',
                                        boxShadow: '0 12px 26px rgba(255,77,0,0.28)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    View Star
                                </div>
                            </div>
                        </button>
                    </div>
                ) : null}

                {(!usesObservatoryModal || isObservatoryModalOpen) ? (
                <div
                    ref={observatoryPaneRef}
                    style={{
                        minWidth: 0,
                        minHeight: usesObservatoryModal ? 0 : isLandscapeLayout ? 0 : scalePx(760),
                        height: usesObservatoryModal ? '100vh' : '100%',
                        position: usesObservatoryModal ? 'fixed' : 'relative',
                        inset: usesObservatoryModal ? 0 : undefined,
                        zIndex: usesObservatoryModal ? 40 : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: usesObservatoryModal ? 'rgba(0,0,0,0.96)' : undefined,
                        transformOrigin: 'top right',
                        animation: usesObservatoryModal
                            ? `${isObservatoryModalClosing ? 'asterObservatoryModalClose' : 'asterObservatoryModalOpen'} 320ms cubic-bezier(0.22, 0.78, 0.28, 1) forwards`
                            : undefined,
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 12,
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 1fr',
                            alignItems: 'center',
                            gap: scalePx(12),
                            paddingTop: scalePx(4),
                            pointerEvents: 'auto',
                        }}
                    >
                        {usesObservatoryModal ? (
                            <button
                                type="button"
                                onClick={handleCloseObservatoryModal}
                                style={{
                                    justifySelf: 'start',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: scalePx(8),
                                    marginLeft: scalePx(8),
                                    padding: `${scalePx(10)} ${scalePx(16)}`,
                                    borderRadius: '999px',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    background: 'rgba(9,13,22,0.7)',
                                    color: 'white',
                                    fontSize: scaleRem(0.86),
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(14px)',
                                }}
                            >
                                <ArrowLeft size={15 * leftUiScale} /> Close
                            </button>
                        ) : (
                            <div />
                        )}
                        <button
                            onClick={onViewInGalaxy}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: scalePx(10),
                                minWidth: scalePx(isLandscapeLayout ? 240 : 210),
                                background: 'var(--primary)',
                                border: '1px solid rgba(255,255,255,0.22)',
                                color: 'white',
                                padding: `${scalePx(14)} ${scalePx(30)}`,
                                borderRadius: '999px',
                                cursor: 'pointer',
                                backdropFilter: 'blur(14px)',
                                transition: 'all 0.2s',
                                boxShadow: '0 16px 36px rgba(255,77,0,0.38)',
                                fontWeight: 'bold',
                                fontSize: scaleRem(0.98),
                                letterSpacing: '0.02em',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px) scale(1.01)';
                                e.currentTarget.style.boxShadow = '0 20px 42px rgba(255,77,0,0.46)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 16px 36px rgba(255,77,0,0.38)';
                            }}
                        >
                            View in atlas
                        </button>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: scalePx(10),
                                pointerEvents: canEditActiveObservatory ? 'auto' : 'none',
                                opacity: canEditActiveObservatory ? 1 : 0,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setLayoutEditMode((current) => !current)}
                                style={{
                                    padding: `${scalePx(10)} ${scalePx(14)}`,
                                    borderRadius: '999px',
                                    border: `1px solid ${layoutEditMode ? 'rgba(255,122,64,0.45)' : 'rgba(255,255,255,0.12)'}`,
                                    background: layoutEditMode ? 'rgba(255,122,64,0.16)' : 'rgba(9,13,22,0.55)',
                                    color: 'white',
                                    fontSize: scaleRem(0.82),
                                    fontWeight: 'bold',
                                    letterSpacing: '0.04em',
                                    backdropFilter: 'blur(12px)',
                                }}
                            >
                                {layoutEditMode ? 'Done Arranging' : 'Arrange Modules'}
                            </button>
                            <button
                                type="button"
                                onClick={handleResetObservatoryLayout}
                                style={{
                                    padding: `${scalePx(10)} ${scalePx(14)}`,
                                    borderRadius: '999px',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'rgba(9,13,22,0.55)',
                                    color: '#d7dae7',
                                    fontSize: scaleRem(0.82),
                                    fontWeight: 'bold',
                                    letterSpacing: '0.04em',
                                    backdropFilter: 'blur(12px)',
                                }}
                            >
                                Reset Layout
                            </button>
                        </div>
                    </div>

                    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'radial-gradient(circle at 58% 47%, rgba(255,132,64,0.07) 0%, rgba(33,44,75,0.03) 28%, rgba(0,0,0,0) 66%)',
                                pointerEvents: 'none',
                            }}
                        />
                        {!isPortraitObservatoryOpen ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${activeStarLayout.x}%`,
                                    top: `${activeStarLayout.y}%`,
                                    width: `${centeredStarDisplaySize}px`,
                                    height: `${centeredStarDisplaySize}px`,
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 3,
                                    pointerEvents: 'none',
                                }}
                            >
                                <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
                                    <ambientLight intensity={0.2} />
                                    <pointLight position={[10, 5, 10]} intensity={1.5} />
                                    <pointLight position={[-10, -5, -10]} intensity={0.5} />
                                    <group scale={[0.392, 0.392, 0.392]}>
                                        <DetailedStar star={star} detailLevel="hero" />
                                    </group>
                                </Canvas>
                            </div>
                        ) : null}
                        <div
                            style={{
                                position: 'absolute',
                                left: '0',
                                top: '0',
                                width: `${observatoryDesignWidth}px`,
                                height: `${observatoryDesignHeight}px`,
                                transform: `translate(${observatorySceneTransform.offsetX}px, ${observatorySceneTransform.offsetY}px) scale(${observatorySceneTransform.scale})`,
                                transformOrigin: 'top left',
                                pointerEvents: 'auto',
                            }}
                        >
                            <ObservatoryBackdrop starLayout={centeredStarSceneLayout} hoveredInstrument={hoveredInstrument} />

                            <div ref={observatoryCanvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
                                <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
                                    {observatoryConnectors.map((connector) => (
                                        <React.Fragment key={connector.key}>
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: `${connector.startX}%`,
                                                    top: `${connector.startY}%`,
                                                    width: `${connector.length}%`,
                                                    height: '1px',
                                                    transformOrigin: '0 50%',
                                                    transform: `rotate(${connector.angle}deg)`,
                                                    background: hoveredInstrument === connector.key
                                                        ? 'linear-gradient(90deg, rgba(255,170,120,0.42) 0%, rgba(255,255,255,0.14) 56%, rgba(255,255,255,0) 100%)'
                                                        : 'linear-gradient(90deg, rgba(132,166,255,0.16) 0%, rgba(255,255,255,0.08) 56%, rgba(255,255,255,0) 100%)',
                                                    opacity: hoveredInstrument && hoveredInstrument !== connector.key ? 0.3 : 0.8,
                                                }}
                                            />
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: `${connector.startX}%`,
                                                    top: `${connector.startY}%`,
                                                    width: '7px',
                                                    height: '7px',
                                                    transform: 'translate(-50%, -50%)',
                                                    borderRadius: '999px',
                                                    background: hoveredInstrument === connector.key ? '#ffb17a' : 'rgba(188,206,255,0.72)',
                                                    boxShadow: hoveredInstrument === connector.key ? '0 0 18px rgba(255,177,122,0.3)' : '0 0 12px rgba(188,206,255,0.18)',
                                                }}
                                            />
                                        </React.Fragment>
                                    ))}
                                </div>

                        {hasLuminosity
                            ? renderObservatoryModule(
                                'luminosity',
                                <CircularGauge
                                    value={Math.log10(1 + activeStar.luminosity)}
                                    max={Math.log10(100001)}
                                    label={formatCompact(activeStar.luminosity, activeStar.luminosity > 999 ? 1 : 2)}
                                    subtitle={luminosityPercentile || 'Relative to Solar luminosity'}
                                />
                            )
                            : null}

                        {renderObservatoryModule(
                            'structure',
                            <ComparisonModule
                                radius={activeStar.radius_flame}
                                mass={activeStar.mass_flame}
                                radiusSubtitle={radiusPercentile || undefined}
                                massSubtitle={massPercentile || undefined}
                            />
                        )}

                        {hasDistance
                            ? renderObservatoryModule('distance', <DistanceModule distanceLy={activeStar.distance_ly} />)
                            : null}

                        {false && spectralDisplay ? (
                            <div style={{ position: 'absolute', right: '1%', top: '74%', width: '24%' }}>
                                <SpectralBandModule
                                    activeBand={spectralBand}
                                    subtitle={`${spectralDisplay.label} · ${spectralDisplay.value}`}
                                />
                            </div>
                        ) : null}

                        {false && (typeof activeStar.color_index === 'number' || typeof activeStar.bp_rp === 'number') ? (
                            <div style={{ position: 'absolute', left: '4%', top: '31%', width: '20%' }}>
                                <ColorIndexModule colorIndex={activeStar.color_index ?? activeStar.bp_rp} />
                            </div>
                        ) : null}

                        {false && ((typeof activeStar.apparent_magnitude === 'number' || typeof activeStar.absolute_magnitude === 'number')) ? (
                            <div style={{ position: 'absolute', right: '1%', top: '34%', width: '21%' }}>
                                <BrightnessModule
                                    apparentMagnitude={activeStar.apparent_magnitude}
                                    absoluteMagnitude={activeStar.absolute_magnitude}
                                />
                            </div>
                        ) : null}

                        {false && (activeStar.constellation || (typeof activeStar.ra_degrees === 'number' && typeof activeStar.dec_degrees === 'number')) ? (
                            <div style={{ position: 'absolute', right: '1%', bottom: '1.5%', width: '24%' }}>
                                <SkyPositionModule star={activeStar} />
                            </div>
                        ) : null}

                        {false && typeof activeStar.age_flame === 'number' ? (
                            <div style={{ position: 'absolute', left: '11%', bottom: '2%', width: '34%' }}>
                                <AgeTimelineModule age={activeStar.age_flame} />
                            </div>
                        ) : null}

                        {hasSpectral
                            ? renderObservatoryModule(
                                'spectral',
                                <SpectralBandModule
                                    activeBand={spectralBand}
                                    subtitle={`${spectralDisplay.label} · ${spectralDisplay.value}`}
                                />
                            )
                            : null}

                        {hasColorIndex
                            ? renderObservatoryModule(
                                'colorIndex',
                                <ColorIndexModule colorIndex={activeStar.color_index ?? activeStar.bp_rp} />
                            )
                            : null}

                        {hasBrightness
                            ? renderObservatoryModule(
                                'brightness',
                                <BrightnessModule
                                    apparentMagnitude={activeStar.apparent_magnitude}
                                    absoluteMagnitude={activeStar.absolute_magnitude}
                                />
                            )
                            : null}

                        {hasSkyPosition
                            ? renderObservatoryModule('sky', <SkyPositionModule star={activeStar} />)
                            : null}

                        {hasAge
                            ? renderObservatoryModule('age', <AgeTimelineModule age={activeStar.age_flame} />)
                            : null}
                    </div>
                    </div>
                </div>
                </div>
                ) : null}

                {isPortraitObservatoryOpen ? (
                    <div
                        style={{
                            position: 'fixed',
                            left: '50vw',
                            top: '50vh',
                            width: `${centeredStarDisplaySize}px`,
                            height: `${centeredStarDisplaySize}px`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 43,
                            pointerEvents: 'none',
                        }}
                    >
                        <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
                            <ambientLight intensity={0.2} />
                            <pointLight position={[10, 5, 10]} intensity={1.5} />
                            <pointLight position={[-10, -5, -10]} intensity={0.5} />
                            <group scale={[0.392, 0.392, 0.392]}>
                                <DetailedStar star={star} detailLevel="hero" />
                            </group>
                        </Canvas>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default StarViewer;
