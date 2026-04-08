const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const asNumber = (value) => {
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

const normalizeLinear = (value, min, max) => {
    if (value === null || !Number.isFinite(value) || max <= min) {
        return 0.5;
    }
    return clamp((value - min) / (max - min), 0, 1);
};

const normalizeLog = (value, min, max) => {
    if (value === null || !Number.isFinite(value) || value <= 0 || min <= 0 || max <= min) {
        return 0.5;
    }

    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = Math.log10(clamp(value, min, max));
    return clamp((logValue - logMin) / (logMax - logMin), 0, 1);
};

const hashString32 = (input) => {
    const text = `${input ?? 'aster-atlas-star'}`;
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
};

const mulberry32 = (seed) => {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const jitter = (prng, amount) => ((prng() * 2) - 1) * amount;

const variabilityFactorFromClass = (bestClassName) => {
    const key = `${bestClassName || ''}`.trim().toUpperCase();
    if (!key) return 0.0;
    if (['MIRA', 'MIRA_SR', 'RVA', 'RVB', 'RVT'].includes(key)) return 0.92;
    if (['RRAB', 'RRC', 'CEP', 'DCEP', 'ACEP', 'BLHER'].includes(key)) return 0.78;
    if (['DSCT_SXPHE', 'GDOR', 'SPB', 'BCEP', 'ROAP'].includes(key)) return 0.58;
    if (['EA', 'EB', 'EW', 'ELL', 'ROT'].includes(key)) return 0.42;
    if (['SOLAR_LIKE', 'RS', 'BY', 'GCAS'].includes(key)) return 0.34;
    return 0.18;
};

const FAMILY_DEFAULTS = {
    compact: {
        surfaceCellScale: 12.5,
        surfaceCellContrast: 0.62,
        surfaceNoiseLowFreq: 2.4,
        surfaceNoiseHighFreq: 15.0,
        surfaceDriftSpeed: 0.25,
        limbSoftness: 0.18,
        limbDarkening: 0.46,
        atmosphereThickness: 0.04,
        coronaExtent: 0.08,
        coronaTurbulence: 0.32,
        coronaSpeed: 0.22,
        spotDensity: 0.18,
        spotScale: 11.0,
        spotContrast: 0.26,
        flareCount: 2,
        flareSpawnBias: 0.34,
        flareScale: 0.14,
        flareLifetime: 0.28,
        prominenceCount: 1,
        prominenceHeight: 0.12,
        pulseAmplitude: 0.006,
        pulseFrequency: 0.65,
        rotationSpeed: 0.12,
        edgeDistortion: 0.04,
    },
    main_sequence: {
        surfaceCellScale: 8.2,
        surfaceCellContrast: 0.54,
        surfaceNoiseLowFreq: 2.0,
        surfaceNoiseHighFreq: 11.0,
        surfaceDriftSpeed: 0.22,
        limbSoftness: 0.24,
        limbDarkening: 0.4,
        atmosphereThickness: 0.07,
        coronaExtent: 0.11,
        coronaTurbulence: 0.42,
        coronaSpeed: 0.28,
        spotDensity: 0.24,
        spotScale: 8.2,
        spotContrast: 0.32,
        flareCount: 3,
        flareSpawnBias: 0.4,
        flareScale: 0.17,
        flareLifetime: 0.34,
        prominenceCount: 2,
        prominenceHeight: 0.16,
        pulseAmplitude: 0.008,
        pulseFrequency: 0.78,
        rotationSpeed: 0.095,
        edgeDistortion: 0.06,
    },
    subgiant: {
        surfaceCellScale: 6.2,
        surfaceCellContrast: 0.5,
        surfaceNoiseLowFreq: 1.8,
        surfaceNoiseHighFreq: 9.2,
        surfaceDriftSpeed: 0.18,
        limbSoftness: 0.34,
        limbDarkening: 0.3,
        atmosphereThickness: 0.11,
        coronaExtent: 0.16,
        coronaTurbulence: 0.52,
        coronaSpeed: 0.24,
        spotDensity: 0.22,
        spotScale: 6.6,
        spotContrast: 0.28,
        flareCount: 4,
        flareSpawnBias: 0.46,
        flareScale: 0.2,
        flareLifetime: 0.42,
        prominenceCount: 3,
        prominenceHeight: 0.2,
        pulseAmplitude: 0.012,
        pulseFrequency: 0.58,
        rotationSpeed: 0.075,
        edgeDistortion: 0.08,
    },
    giant: {
        surfaceCellScale: 4.2,
        surfaceCellContrast: 0.48,
        surfaceNoiseLowFreq: 1.5,
        surfaceNoiseHighFreq: 6.5,
        surfaceDriftSpeed: 0.12,
        limbSoftness: 0.48,
        limbDarkening: 0.2,
        atmosphereThickness: 0.18,
        coronaExtent: 0.22,
        coronaTurbulence: 0.64,
        coronaSpeed: 0.18,
        spotDensity: 0.2,
        spotScale: 4.8,
        spotContrast: 0.24,
        flareCount: 5,
        flareSpawnBias: 0.5,
        flareScale: 0.24,
        flareLifetime: 0.52,
        prominenceCount: 4,
        prominenceHeight: 0.26,
        pulseAmplitude: 0.018,
        pulseFrequency: 0.42,
        rotationSpeed: 0.05,
        edgeDistortion: 0.1,
    },
    supergiant: {
        surfaceCellScale: 2.5,
        surfaceCellContrast: 0.56,
        surfaceNoiseLowFreq: 1.2,
        surfaceNoiseHighFreq: 4.5,
        surfaceDriftSpeed: 0.08,
        limbSoftness: 0.62,
        limbDarkening: 0.12,
        atmosphereThickness: 0.27,
        coronaExtent: 0.31,
        coronaTurbulence: 0.78,
        coronaSpeed: 0.14,
        spotDensity: 0.28,
        spotScale: 3.2,
        spotContrast: 0.22,
        flareCount: 6,
        flareSpawnBias: 0.56,
        flareScale: 0.32,
        flareLifetime: 0.64,
        prominenceCount: 5,
        prominenceHeight: 0.34,
        pulseAmplitude: 0.024,
        pulseFrequency: 0.26,
        rotationSpeed: 0.034,
        edgeDistortion: 0.14,
    },
};

const pickHintFamily = (category) => {
    const normalized = `${category || ''}`.toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('white dwarf') || normalized.includes('neutron') || normalized.includes('compact')) return 'compact';
    if (normalized.includes('supergiant')) return 'supergiant';
    if (normalized.includes('giant')) return 'giant';
    if (normalized.includes('subgiant')) return 'subgiant';
    if (normalized.includes('dwarf')) return 'main_sequence';
    return null;
};

const buildAnchorSet = (count, prng, radius, spread, sizeBase, lifetimeBase) => {
    const anchors = [];
    for (let index = 0; index < count; index += 1) {
        const u = (prng() * 2) - 1;
        const phi = prng() * Math.PI * 2;
        const root = Math.sqrt(Math.max(0, 1 - (u * u)));
        anchors.push({
            position: [
                root * Math.cos(phi) * radius,
                u * radius,
                root * Math.sin(phi) * radius,
            ],
            size: sizeBase * (0.78 + (prng() * 0.52)),
            phase: prng() * Math.PI * 2,
            lifetime: lifetimeBase * (0.82 + (prng() * 0.4)),
            intensity: 0.72 + (prng() * 0.4),
            spread: spread * (0.82 + (prng() * 0.36)),
        });
    }
    return anchors;
};

export const buildStarMorphologyProfile = (star) => {
    const seedSource = star?.source_id || star?.gaia_source_id || star?.id || star?.scientific_name || star?.name || star?.category || 'aster-atlas-star';
    const seed = hashString32(seedSource);
    const prng = mulberry32(seed);

    const radius = asNumber(star?.radius_flame);
    const luminosity = asNumber(star?.lum_flame ?? star?.luminosity);
    const mass = asNumber(star?.mass_flame);
    const age = asNumber(star?.age_flame);
    const temperature = asNumber(star?.teff_gspphot);
    const logg = asNumber(star?.logg_gspphot);
    const evolstage = asNumber(star?.evolstage_flame);
    const bpRp = asNumber(star?.bp_rp ?? star?.color_index);
    const radialVelocity = Math.abs(asNumber(star?.radial_velocity) ?? 0);
    const pm = asNumber(star?.pm) ?? Math.hypot(asNumber(star?.pmra) ?? 0, asNumber(star?.pmdec) ?? 0);
    const binaryProbability = asNumber(star?.classprob_dsc_combmod_binarystar);
    const nonSingle = Boolean(star?.non_single_star);
    const variableFlag = `${star?.phot_variable_flag ?? ''}`.trim().toUpperCase();
    const variabilityFactor = variabilityFactorFromClass(star?.best_class_name);
    const isVariable = variableFlag && !['NOT_AVAILABLE', 'CONSTANT', 'N', 'FALSE', '0', 'NO'].includes(variableFlag);

    const radiusNorm = normalizeLog(radius, 0.08, 1800);
    const luminosityNorm = normalizeLog(luminosity, 1e-4, 1e6);
    const massNorm = normalizeLog(mass, 0.08, 120);
    const ageNorm = normalizeLinear(age, 0, 13.8);
    const temperatureNorm = normalizeLinear(temperature, 2200, 38000);
    const inverseGravityNorm = logg === null ? clamp((radiusNorm * 0.55) + (luminosityNorm * 0.45), 0, 1) : 1 - normalizeLinear(logg, 0, 5.6);
    const properMotionNorm = normalizeLog(pm, 0.02, 5000);
    const radialVelocityNorm = normalizeLinear(radialVelocity, 0, 350);
    const colourOffsetNorm = bpRp === null ? 0.5 : normalizeLinear(Math.abs(bpRp - 0.82), 0, 2.6);
    const binaryNorm = binaryProbability !== null ? normalizeLinear(binaryProbability, 0, 1) : (nonSingle ? 0.78 : 0.18);

    const lifetimeEnergyOutputScore = clamp(
        (luminosityNorm * 0.44)
        + (massNorm * 0.22)
        + (ageNorm * 0.18)
        + ((1 - temperatureNorm) * 0.16),
        0,
        1
    );

    const sizeFeel = clamp((radiusNorm * 0.68) + (luminosityNorm * 0.22) + (massNorm * 0.1), 0, 1);
    const puffiness = clamp((radiusNorm * 0.44) + (luminosityNorm * 0.26) + (inverseGravityNorm * 0.3), 0, 1);
    const activity = clamp(
        (isVariable ? 0.32 : 0)
        + (variabilityFactor * 0.42)
        + (binaryNorm * 0.14)
        + (properMotionNorm * 0.06)
        + (radialVelocityNorm * 0.06),
        0,
        1
    );
    const surfaceViolence = clamp((massNorm * 0.44) + (temperatureNorm * 0.26) + (activity * 0.3), 0, 1);
    const pulseStrength = clamp((isVariable ? 0.4 : 0.05) + (variabilityFactor * 0.55) + (binaryNorm * 0.08), 0, 1);
    const atmosphereStrength = clamp((luminosityNorm * 0.5) + (puffiness * 0.35) + (sizeFeel * 0.15), 0, 1);

    const categoryHint = pickHintFamily(star?.category);
    const stageNorm = evolstage === null ? 0.5 : normalizeLinear(evolstage, 0, 7.5);

    const familyScores = {
        compact: clamp((1 - sizeFeel) * 0.56 + (1 - puffiness) * 0.22 + (1 - atmosphereStrength) * 0.14 + (1 - stageNorm) * 0.08, 0, 1),
        main_sequence: clamp((1 - Math.abs(sizeFeel - 0.34)) * 0.34 + (1 - Math.abs(puffiness - 0.28)) * 0.24 + (1 - Math.abs(stageNorm - 0.35)) * 0.2 + (1 - Math.abs(atmosphereStrength - 0.32)) * 0.22, 0, 1),
        subgiant: clamp((1 - Math.abs(sizeFeel - 0.48)) * 0.3 + (1 - Math.abs(puffiness - 0.46)) * 0.26 + (1 - Math.abs(stageNorm - 0.55)) * 0.22 + (1 - Math.abs(atmosphereStrength - 0.5)) * 0.22, 0, 1),
        giant: clamp((sizeFeel * 0.3) + (puffiness * 0.28) + (atmosphereStrength * 0.22) + (stageNorm * 0.2), 0, 1),
        supergiant: clamp((sizeFeel * 0.26) + (puffiness * 0.24) + (atmosphereStrength * 0.22) + (stageNorm * 0.18) + (luminosityNorm * 0.1), 0, 1),
    };

    if (categoryHint) {
        familyScores[categoryHint] += 0.16;
    }

    const family = Object.entries(familyScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'main_sequence';
    const defaults = FAMILY_DEFAULTS[family];

    const profile = {
        family,
        seed,
        sizeFeel,
        puffiness,
        surfaceViolence,
        activity,
        pulseStrength,
        atmosphereStrength,
        lifetimeEnergyOutputScore,
        seedVector: [
            (prng() * 2) - 1,
            (prng() * 2) - 1,
            (prng() * 2) - 1,
        ],
    };

    profile.surfaceCellScale = defaults.surfaceCellScale * (1 - (sizeFeel * 0.16)) * (1 + jitter(prng, 0.08));
    profile.surfaceCellContrast = clamp(defaults.surfaceCellContrast + (surfaceViolence * 0.12) - (puffiness * 0.08) + jitter(prng, 0.06), 0.18, 0.9);
    profile.surfaceNoiseLowFreq = defaults.surfaceNoiseLowFreq * (1 + (atmosphereStrength * 0.12) + jitter(prng, 0.08));
    profile.surfaceNoiseHighFreq = defaults.surfaceNoiseHighFreq * (1 + (surfaceViolence * 0.18) + jitter(prng, 0.08));
    profile.surfaceDriftSpeed = defaults.surfaceDriftSpeed * (1 + (activity * 0.35) + jitter(prng, 0.08));
    profile.limbSoftness = clamp(defaults.limbSoftness + (puffiness * 0.18) + jitter(prng, 0.04), 0.08, 0.88);
    profile.limbDarkening = clamp(defaults.limbDarkening + ((1 - puffiness) * 0.12) + jitter(prng, 0.04), 0.05, 0.82);
    profile.atmosphereThickness = clamp(defaults.atmosphereThickness + (atmosphereStrength * 0.12) + jitter(prng, 0.02), 0.02, 0.54);
    profile.coronaExtent = clamp(defaults.coronaExtent + (atmosphereStrength * 0.1) + jitter(prng, 0.04), 0.06, 0.65);
    profile.coronaTurbulence = clamp(defaults.coronaTurbulence + (surfaceViolence * 0.1) + jitter(prng, 0.05), 0.12, 1.0);
    profile.coronaSpeed = defaults.coronaSpeed * (1 + (activity * 0.25) + jitter(prng, 0.08));
    profile.spotDensity = clamp(defaults.spotDensity + (activity * 0.18) + (binaryNorm * 0.06) + jitter(prng, 0.04), 0.04, 0.82);
    profile.spotScale = defaults.spotScale * (1 + ((1 - sizeFeel) * 0.18) + jitter(prng, 0.08));
    profile.spotContrast = clamp(defaults.spotContrast + (surfaceViolence * 0.1) + jitter(prng, 0.04), 0.08, 0.72);
    profile.flareCount = Math.max(0, Math.round(defaults.flareCount + (activity * 3.2) + jitter(prng, 2.0)));
    profile.flareSpawnBias = clamp(defaults.flareSpawnBias + (activity * 0.18) + jitter(prng, 0.05), 0.1, 0.92);
    profile.flareScale = clamp(defaults.flareScale + (surfaceViolence * 0.08) + jitter(prng, 0.02), 0.08, 0.58);
    profile.flareLifetime = clamp(defaults.flareLifetime + (pulseStrength * 0.1) + jitter(prng, 0.04), 0.14, 0.92);
    profile.prominenceCount = Math.max(0, Math.round(defaults.prominenceCount + (atmosphereStrength * 2.2) + jitter(prng, 2.0)));
    profile.prominenceHeight = clamp(defaults.prominenceHeight + (atmosphereStrength * 0.08) + jitter(prng, 0.03), 0.06, 0.58);
    profile.pulseAmplitude = clamp(defaults.pulseAmplitude + (pulseStrength * 0.02) + jitter(prng, 0.0025), 0, 0.05);
    profile.pulseFrequency = clamp(defaults.pulseFrequency + (activity * 0.12) + jitter(prng, 0.06), 0.08, 1.4);
    profile.rotationSpeed = clamp(defaults.rotationSpeed * (1 + (surfaceViolence * 0.18) + jitter(prng, 0.1)), 0.01, 0.22);
    profile.edgeDistortion = clamp(defaults.edgeDistortion + (activity * 0.08) + jitter(prng, 0.02), 0.01, 0.24);

    profile.flareAnchors = buildAnchorSet(
        profile.flareCount,
        prng,
        2.05,
        profile.flareScale,
        profile.flareScale,
        profile.flareLifetime
    );
    profile.prominenceAnchors = buildAnchorSet(
        profile.prominenceCount,
        prng,
        2.02,
        profile.prominenceHeight,
        profile.prominenceHeight * 0.8,
        0.62
    );

    return profile;
};
