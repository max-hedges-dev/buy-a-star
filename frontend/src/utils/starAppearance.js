import * as THREE from 'three';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getNumeric = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};

const categoryToFamily = (category = '') => {
    const normalized = String(category).toLowerCase();
    if (normalized.includes('blue-white')) return 'Blue-White';
    if (normalized.includes('yellow-white')) return 'Yellow-White';
    if (normalized.includes('white')) return 'White';
    if (normalized.includes('blue')) return 'Blue';
    if (normalized.includes('yellow')) return 'Yellow';
    if (normalized.includes('orange')) return 'Orange';
    if (normalized.includes('red')) return 'Red';
    return null;
};

const approximateTemperatureFromBpRp = (bpRp) => {
    const colorIndex = getNumeric(bpRp);
    if (colorIndex === null) {
        return null;
    }
    const bounded = clamp(colorIndex, -0.35, 4.2);
    return 4600 * ((1 / ((0.92 * bounded) + 1.7)) + (1 / ((0.92 * bounded) + 0.62)));
};

const SPECTRAL_TEMPERATURES = {
    O: 32000,
    B: 18000,
    A: 9200,
    F: 7000,
    G: 5700,
    K: 4500,
    M: 3400,
    L: 2200,
    T: 1300,
    Y: 700,
    C: 3000,
    S: 3300,
    D: 11000,
    W: 45000,
};

export const getEffectiveTemperature = (star) => {
    const explicitTemp = getNumeric(star?.teff_gspphot);
    if (explicitTemp && explicitTemp > 0) {
        return explicitTemp;
    }

    const bpRpTemp = approximateTemperatureFromBpRp(star?.bp_rp ?? star?.color_index);
    if (bpRpTemp && bpRpTemp > 0) {
        return bpRpTemp;
    }

    const spectral = `${star?.spectral_type || ''}`.trim().toUpperCase();
    const family = spectral[0];
    if (family && SPECTRAL_TEMPERATURES[family]) {
        return SPECTRAL_TEMPERATURES[family];
    }

    return 5700;
};

export const getColorFamily = (star) => {
    const explicitFamily = categoryToFamily(star?.category);
    if (explicitFamily) {
        return explicitFamily;
    }

    const temperature = getEffectiveTemperature(star);
    if (temperature >= 26000) return 'Blue';
    if (temperature >= 11000) return 'Blue-White';
    if (temperature >= 7800) return 'White';
    if (temperature >= 6200) return 'Yellow-White';
    if (temperature >= 5400) return 'Yellow';
    if (temperature >= 3900) return 'Orange';
    return 'Red';
};

export const getSpectralDisplay = (star) => {
    const spectralType = `${star?.spectral_type || ''}`.trim();
    if (!spectralType) {
        return null;
    }

    if (star?.source_catalog === 'Gaia DR3') {
        return {
            label: 'Gaia spectral family',
            value: spectralType,
            sentence: `Gaia places it in the ${spectralType} spectral family.`,
        };
    }

    return {
        label: 'Spectral type',
        value: spectralType,
        sentence: `Its spectral classification is ${spectralType}.`,
    };
};

const FAMILY_ANCHORS = {
    Blue: { hue: 0.61, saturation: 0.92, lightness: 0.56 },
    'Blue-White': { hue: 0.59, saturation: 0.76, lightness: 0.7 },
    White: { hue: 0.58, saturation: 0.18, lightness: 0.9 },
    'Yellow-White': { hue: 0.12, saturation: 0.6, lightness: 0.8 },
    Yellow: { hue: 0.12, saturation: 0.9, lightness: 0.56 },
    Orange: { hue: 0.082, saturation: 0.92, lightness: 0.5 },
    Red: { hue: 0.02, saturation: 0.82, lightness: 0.54 },
};

const createColor = (hue, saturation, lightness) => new THREE.Color().setHSL(
    ((hue % 1) + 1) % 1,
    clamp(saturation, 0, 1),
    clamp(lightness, 0, 1)
);

export const getStarAppearance = (star) => {
    const family = getColorFamily(star);
    const temperature = getEffectiveTemperature(star);
    const bpRp = getNumeric(star?.bp_rp ?? star?.color_index);
    const luminosity = Math.max(0, getNumeric(star?.lum_flame ?? star?.luminosity) ?? 0);
    const radius = Math.max(0, getNumeric(star?.radius_flame) ?? 0);

    const anchor = FAMILY_ANCHORS[family] || FAMILY_ANCHORS.Yellow;
    const temperatureNorm = clamp((Math.log10(temperature) - Math.log10(2500)) / (Math.log10(32000) - Math.log10(2500)), 0, 1);
    const heatOffset = (temperatureNorm - 0.5) * 2;
    const bpRpNorm = bpRp === null ? 0 : clamp((bpRp - 0.8) / 1.8, -1, 1);
    const luminosityFactor = clamp(Math.log10(1 + luminosity) / Math.log10(60001), 0, 1);
    const radiusFactor = clamp(Math.log10(1 + radius) / Math.log10(201), 0, 1);
    const stature = clamp(radiusFactor * 0.55 + luminosityFactor * 0.45, 0, 1);
    const redDepth = bpRp === null ? 0.45 : clamp((bpRp - 1.2) / 1.7, 0, 1);
    const coolRedness = clamp((4200 - temperature) / (4200 - 2400), 0, 1);
    const warmBias = clamp((6200 - temperature) / 3200, -1, 1);
    const coolBias = clamp((temperature - 7000) / 13000, -1, 1);
    const familyVariance = clamp(Math.abs(bpRpNorm) * 0.65 + stature * 0.35, 0, 1);

    let hue = anchor.hue;
    let saturation = anchor.saturation;
    let lightness = anchor.lightness;

    switch (family) {
        case 'Blue':
            hue = 0.615 - (coolBias * 0.03) - (bpRpNorm * 0.012);
            saturation = 0.82 + (temperatureNorm * 0.14) + (familyVariance * 0.07) - (stature * 0.035);
            lightness = 0.54 + (stature * 0.05) + (temperatureNorm * 0.035);
            break;
        case 'Blue-White':
            hue = 0.595 - (coolBias * 0.026) + (bpRpNorm * 0.01);
            saturation = 0.62 + (temperatureNorm * 0.18) + (familyVariance * 0.09) - (stature * 0.015);
            lightness = 0.67 + (stature * 0.04) + (temperatureNorm * 0.025);
            break;
        case 'White':
            hue = 0.11 + (bpRpNorm * 0.09) - (coolBias * 0.05);
            saturation = 0.08 + (Math.abs(bpRpNorm) * 0.3) + (familyVariance * 0.12);
            lightness = 0.84 + (stature * 0.03) - (Math.abs(bpRpNorm) * 0.04);
            break;
        case 'Yellow-White':
            hue = 0.125 - (coolBias * 0.03) - (bpRpNorm * 0.032);
            saturation = 0.42 + (Math.abs(bpRpNorm) * 0.18) + (familyVariance * 0.08);
            lightness = 0.78 + (stature * 0.03) - (bpRpNorm * 0.025);
            break;
        case 'Yellow':
            hue = 0.128 - (warmBias * 0.014) - (bpRpNorm * 0.024);
            saturation = 0.8 + (familyVariance * 0.12) + (stature * 0.04);
            lightness = 0.54 + (stature * 0.05) - (bpRpNorm * 0.018);
            break;
        case 'Orange':
            hue = 0.085 - (warmBias * 0.016) - (bpRpNorm * 0.03);
            saturation = 0.84 + (familyVariance * 0.1) + (stature * 0.03);
            lightness = 0.49 + (stature * 0.05) - (warmBias * 0.02);
            break;
        case 'Red':
            // Spread red stars across a broader crimson <-> orange-red band.
            // Cooler / higher-bp_rp stars move toward deeper red, while warmer
            // edge-of-red stars stay closer to orange-red.
            hue = 0.058 - (redDepth * 0.038) - (coolRedness * 0.026) - (stature * 0.006);
            saturation = 0.74 + (redDepth * 0.16) + (coolRedness * 0.08) + (stature * 0.03);
            lightness = 0.5 + (stature * 0.07) - (coolRedness * 0.06) + ((1 - redDepth) * 0.03);
            break;
        default:
            break;
    }

    const surface = createColor(hue, saturation, lightness);
    const hot = createColor(hue, saturation * 0.72, lightness + 0.14);
    const corona = createColor(hue + (family === 'Blue' || family === 'Blue-White' ? -0.01 : 0.008), saturation * 0.92, lightness + 0.04);
    const flare = createColor(hue, saturation * 0.82, lightness + 0.1);
    const bloom = createColor(hue, saturation * 0.7, lightness + 0.18);

    const previewCore = createColor(hue, saturation * 0.66, lightness + 0.1);
    const previewGlow = createColor(hue, saturation * 0.95, lightness + 0.02);
    const previewRim = createColor(hue, saturation * 0.38, lightness + 0.22);

    return {
        family,
        temperature,
        hotCore: clamp(0.18 + stature * 0.09 + (1 - Math.abs(bpRpNorm)) * 0.06, 0.14, 0.56),
        surface,
        hot,
        corona,
        flare,
        bloom,
        previewCore,
        previewGlow,
        previewRim,
        surfaceHex: `#${surface.getHexString()}`,
        hotHex: `#${hot.getHexString()}`,
        coronaHex: `#${corona.getHexString()}`,
        flareHex: `#${flare.getHexString()}`,
        bloomHex: `#${bloom.getHexString()}`,
        previewCoreHex: `#${previewCore.getHexString()}`,
        previewGlowHex: `#${previewGlow.getHexString()}`,
        previewRimHex: `#${previewRim.getHexString()}`,
    };
};
