import React, { useMemo, useRef } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { getStarAppearance } from '../utils/starAppearance';
import { buildStarMorphologyProfile } from '../utils/starMorphology';

const textureCache = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
    return t * t * (3 - (2 * t));
};

const getRadialTexture = (key, size, stops) => {
    if (textureCache.has(key)) {
        return textureCache.get(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);

    stops.forEach(([offset, color]) => {
        gradient.addColorStop(offset, color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    textureCache.set(key, texture);
    return texture;
};

const HERO_SURFACE_GEOMETRY = new THREE.SphereGeometry(2, 220, 220);
const HERO_SHELL_GEOMETRY = new THREE.SphereGeometry(2, 180, 180);
const HIGH_SURFACE_GEOMETRY = new THREE.SphereGeometry(2, 64, 64);
const HIGH_SHELL_GEOMETRY = new THREE.SphereGeometry(2, 44, 44);
const MEDIUM_SURFACE_GEOMETRY = new THREE.SphereGeometry(2, 24, 24);
const MEDIUM_SHELL_GEOMETRY = new THREE.SphereGeometry(2, 20, 20);

const HERO_BLOOM_TEXTURE = getRadialTexture('hero-bloom', 256, [
    [0, 'rgba(255,255,255,1)'],
    [0.12, 'rgba(255,255,255,0.92)'],
    [0.35, 'rgba(255,255,255,0.32)'],
    [0.72, 'rgba(255,255,255,0.06)'],
    [1, 'rgba(255,255,255,0)'],
]);

const HIGH_BLOOM_TEXTURE = getRadialTexture('high-bloom', 128, [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(255,255,255,0.88)'],
    [0.42, 'rgba(255,255,255,0.24)'],
    [1, 'rgba(255,255,255,0)'],
]);

const MEDIUM_BLOOM_TEXTURE = getRadialTexture('medium-bloom', 96, [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(255,255,255,0.72)'],
    [0.52, 'rgba(255,255,255,0.16)'],
    [1, 'rgba(255,255,255,0)'],
]);

const proceduralNoise = `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  return fract(vec3(
    hash13(p + vec3(1.0, 0.0, 0.0)),
    hash13(p + vec3(0.0, 1.0, 0.0)),
    hash13(p + vec3(0.0, 0.0, 1.0))
  ));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 4; i++) {
    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float worley(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  float minDist = 10.0;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 feature = offset + hash33(cell + offset);
        minDist = min(minDist, length(local - feature));
      }
    }
  }

  return minDist;
}
`;

const StarSurfaceMaterial = shaderMaterial(
    {
        time: 0,
        animate: 1.0,
        baseColor: new THREE.Color('#ffb763'),
        hotColor: new THREE.Color('#fff8ed'),
        hotCore: 0.36,
        cellScale: 6.0,
        cellContrast: 0.5,
        lowFreq: 2.0,
        highFreq: 9.0,
        driftSpeed: 0.2,
        limbSoftness: 0.3,
        limbDarkening: 0.3,
        spotDensity: 0.2,
        spotScale: 7.0,
        spotContrast: 0.3,
        edgeDistortion: 0.08,
        seedVector: new THREE.Vector3(0.2, 0.4, -0.3),
    },
    `
    uniform float time;
    uniform float animate;
    uniform float edgeDistortion;
    uniform vec3 seedVector;

    varying vec3 vObjectDir;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    ${proceduralNoise}

    void main() {
      float t = time * animate;
      vec3 dir = normalize(position);
      float distortion = fbm(dir * 2.1 + seedVector * 4.0 + vec3(t * 0.05, -t * 0.03, t * 0.04));
      vec3 displaced = position * (1.0 + (distortion - 0.5) * edgeDistortion * 0.06);

      vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
      vObjectDir = dir;
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * dir);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
    `
    uniform float time;
    uniform float animate;
    uniform vec3 baseColor;
    uniform vec3 hotColor;
    uniform float hotCore;
    uniform float cellScale;
    uniform float cellContrast;
    uniform float lowFreq;
    uniform float highFreq;
    uniform float driftSpeed;
    uniform float limbSoftness;
    uniform float limbDarkening;
    uniform float spotDensity;
    uniform float spotScale;
    uniform float spotContrast;
    uniform vec3 seedVector;

    varying vec3 vObjectDir;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;

    ${proceduralNoise}

    void main() {
      float t = time * animate;
      vec3 dir = normalize(vObjectDir);
      vec3 drift = vec3(
        t * driftSpeed * 0.75,
        -t * driftSpeed * 0.48,
        t * driftSpeed * 0.62
      );

      float cellMask = 1.0 - worley(dir * cellScale + seedVector * 5.0 + drift);
      float largeBillow = fbm(dir * lowFreq + seedVector * 2.0 + drift * 0.7);
      float fineBillow = fbm(dir.yzx * highFreq + seedVector * 8.0 - drift * 1.5);
      float spotField = fbm(dir * spotScale + seedVector * 9.0 + vec3(0.0, drift.x, drift.z));

      float granulation = mix(cellMask, largeBillow, 0.34);
      granulation = mix(granulation, fineBillow, 0.28);
      granulation = clamp((granulation - 0.24) * (1.0 + cellContrast * 1.9) + 0.56, 0.0, 1.0);

      float spotThreshold = 0.88 - (spotDensity * 0.38);
      float spotMask = smoothstep(spotThreshold, 0.98, spotField);

      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float facing = clamp(dot(normalize(vWorldNormal), viewDir), 0.0, 1.0);
      float rim = pow(1.0 - facing, 1.1 + limbSoftness * 2.8);
      float limbFade = 1.0 - (rim * limbDarkening);

      float hotMix = clamp((granulation * 0.82) + (hotCore * 0.42) + (facing * 0.18), 0.0, 1.0);
      vec3 surface = mix(baseColor * 0.72, hotColor, hotMix);
      surface *= (0.74 + (granulation * 0.48)) * limbFade;
      surface *= 1.0 - (spotMask * spotContrast * 0.78);
      surface += baseColor * rim * (0.11 + limbSoftness * 0.22);
      surface += hotColor * pow(facing, 2.4) * 0.2;

      gl_FragColor = vec4(surface, 1.0);
    }
  `
);

const CoronaShellMaterial = shaderMaterial(
    {
        time: 0,
        animate: 1.0,
        color: new THREE.Color('#ffbb75'),
        intensity: 0.5,
        coronaTurbulence: 0.5,
        coronaSpeed: 0.2,
        coronaExtent: 0.18,
        atmosphereThickness: 0.14,
        edgeDistortion: 0.08,
        flareBias: 0.3,
        seedVector: new THREE.Vector3(0.2, -0.4, 0.6),
    },
    `
    uniform float time;
    uniform float animate;
    uniform float coronaTurbulence;
    uniform float coronaSpeed;
    uniform float coronaExtent;
    uniform float edgeDistortion;
    uniform float flareBias;
    uniform vec3 seedVector;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying float vFlare;
    varying float vBreakup;

    ${proceduralNoise}

    void main() {
      float t = time * animate;
      vec3 dir = normalize(position);
      vec3 drift = vec3(
        t * coronaSpeed * 0.06,
        -t * coronaSpeed * 0.04,
        t * coronaSpeed * 0.05
      );

      float broad = fbm(dir * 2.1 + seedVector * 3.0 + drift);
      float detail = fbm(dir.zxy * 6.4 + seedVector * 6.5 - drift * 1.8);
      float flare = smoothstep(flareBias, 1.0, detail);
      float breakup = mix(broad, detail, 0.45);
      float offset = 0.02 + (coronaExtent * 0.08) + ((breakup - 0.5) * coronaTurbulence * 0.05) + (flare * edgeDistortion * 0.08);
      vec3 displaced = position + dir * offset;

      vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * dir);
      vFlare = flare;
      vBreakup = breakup;

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
    `
    uniform vec3 color;
    uniform float intensity;
    uniform float atmosphereThickness;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying float vFlare;
    varying float vBreakup;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.0);
      float breakup = mix(0.72, 1.32, clamp(vBreakup, 0.0, 1.0));
      float alpha = rim * breakup * (0.16 + atmosphereThickness * 0.64 + vFlare * 0.48) * intensity;
      vec3 coronaColor = mix(color, vec3(1.0), min(vFlare * 0.34, 0.45));
      gl_FragColor = vec4(coronaColor, alpha);
    }
  `
);

extend({ StarSurfaceMaterial, CoronaShellMaterial });

export const getStarPalette = (star) => getStarAppearance(star);

const DETAIL_SETTINGS = {
    hero: {
        surfaceGeometry: HERO_SURFACE_GEOMETRY,
        shellGeometry: HERO_SHELL_GEOMETRY,
        bloomTexture: HERO_BLOOM_TEXTURE,
        bloomScale: 7.8,
        bloomOpacity: 0.24,
        coronaIntensity: 1.5,
    },
    high: {
        surfaceGeometry: HIGH_SURFACE_GEOMETRY,
        shellGeometry: HIGH_SHELL_GEOMETRY,
        bloomTexture: HIGH_BLOOM_TEXTURE,
        bloomScale: 4.8,
        bloomOpacity: 0.1,
        coronaIntensity: 0.52,
    },
    medium: {
        surfaceGeometry: MEDIUM_SURFACE_GEOMETRY,
        shellGeometry: MEDIUM_SHELL_GEOMETRY,
        bloomTexture: MEDIUM_BLOOM_TEXTURE,
        bloomScale: 3.7,
        bloomOpacity: 0.07,
        coronaIntensity: 0.24,
    },
};

const getDetailedBrightnessProfile = (palette) => {
    let surfaceBoost = 1.0;
    let hotBoost = 1.0;
    let coronaBoost = 1.0;
    let bloomBoost = 1.0;
    let bloomOpacityBoost = 1.0;

    if (palette.family === 'Orange') {
        surfaceBoost = 1.2;
        hotBoost = 1.18;
        coronaBoost = 1.2;
        bloomBoost = 1.16;
        bloomOpacityBoost = 1.12;
    } else if (palette.family === 'Red') {
        surfaceBoost = 1.28;
        hotBoost = 1.24;
        coronaBoost = 1.28;
        bloomBoost = 1.22;
        bloomOpacityBoost = 1.16;
    }

    return {
        surface: palette.surface.clone().multiplyScalar(surfaceBoost),
        hot: palette.hot.clone().multiplyScalar(hotBoost),
        corona: palette.corona.clone().multiplyScalar(coronaBoost),
        bloom: palette.bloom.clone().multiplyScalar(bloomBoost),
        bloomOpacityBoost,
    };
};

const ProceduralStar = ({ palette, profile, detailLevel = 'high', playAnimation = true }) => {
    const settings = DETAIL_SETTINGS[detailLevel] || DETAIL_SETTINGS.high;
    const groupRef = useRef();
    const bloomRef = useRef();
    const surfaceRef = useRef();
    const coronaRef = useRef();
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const brightness = useMemo(() => getDetailedBrightnessProfile(palette), [palette]);

    useFrame((state, delta) => {
        const animateValue = playAnimation ? 1.0 : 0.0;
        const elapsed = state.clock.elapsedTime;

        if (groupRef.current) {
            if (playAnimation) {
                groupRef.current.rotation.y += delta * profile.rotationSpeed * 0.0;
                groupRef.current.rotation.z += delta * profile.rotationSpeed * 0.0;
            }
            groupRef.current.scale.setScalar(1);
        }

        if (surfaceRef.current) {
            if (playAnimation) {
                surfaceRef.current.time += delta * 3.15;
            }
            surfaceRef.current.animate = animateValue;
        }

        if (coronaRef.current) {
            if (playAnimation) {
                coronaRef.current.time += delta * 1.96;
            }
            coronaRef.current.animate = animateValue;
        }

        if (bloomRef.current) {
            bloomRef.current.getWorldPosition(worldPosition);
            const distance = state.camera.position.distanceTo(worldPosition);
            bloomRef.current.scale.setScalar(settings.bloomScale * (1 + (profile.coronaExtent * 0.55)));
            bloomRef.current.material.opacity = (settings.bloomOpacity + (distance > 110 ? 0.02 : 0.0)) * brightness.bloomOpacityBoost;
        }
    });

    return (
        <group ref={groupRef}>
            <mesh geometry={settings.surfaceGeometry}>
                <starSurfaceMaterial
                    ref={surfaceRef}
                    baseColor={brightness.surface}
                    hotColor={brightness.hot}
                    hotCore={palette.hotCore}
                    animate={1.0}
                    cellScale={profile.surfaceCellScale}
                    cellContrast={profile.surfaceCellContrast}
                    lowFreq={profile.surfaceNoiseLowFreq}
                    highFreq={profile.surfaceNoiseHighFreq}
                    driftSpeed={profile.surfaceDriftSpeed}
                    limbSoftness={profile.limbSoftness}
                    limbDarkening={profile.limbDarkening}
                    spotDensity={profile.spotDensity}
                    spotScale={profile.spotScale}
                    spotContrast={profile.spotContrast}
                    edgeDistortion={profile.edgeDistortion}
                    seedVector={new THREE.Vector3(...profile.seedVector)}
                    transparent={false}
                    depthWrite={true}
                    depthTest={true}
                />
            </mesh>

            <mesh
                geometry={settings.shellGeometry}
                scale={[
                    1.015 + (profile.atmosphereThickness * 0.05),
                    1.015 + (profile.atmosphereThickness * 0.05),
                    1.015 + (profile.atmosphereThickness * 0.05),
                ]}
            >
                <coronaShellMaterial
                    ref={coronaRef}
                    color={brightness.corona}
                    animate={1.0}
                    intensity={settings.coronaIntensity * (palette.family === 'Orange' ? 1.14 : palette.family === 'Red' ? 1.2 : 1.0)}
                    coronaTurbulence={profile.coronaTurbulence}
                    coronaSpeed={profile.coronaSpeed}
                    coronaExtent={profile.coronaExtent}
                    atmosphereThickness={profile.atmosphereThickness}
                    edgeDistortion={profile.edgeDistortion}
                    flareBias={clamp(0.36 - (profile.activity * 0.12), 0.18, 0.52)}
                    seedVector={new THREE.Vector3(...profile.seedVector)}
                    transparent
                    depthWrite={false}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            <sprite ref={bloomRef} scale={[settings.bloomScale, settings.bloomScale, 1]}>
                <spriteMaterial
                    map={settings.bloomTexture}
                    color={brightness.bloom}
                    transparent
                    opacity={settings.bloomOpacity * brightness.bloomOpacityBoost}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </sprite>
        </group>
    );
};

const DetailedStar = ({ star, detailLevel = 'high', playAnimation = true }) => {
    const palette = useMemo(() => getStarAppearance(star), [star]);
    const profile = useMemo(() => buildStarMorphologyProfile(star), [star]);

    return (
        <ProceduralStar
            palette={palette}
            profile={profile}
            detailLevel={detailLevel}
            playAnimation={playAnimation}
        />
    );
};

export default DetailedStar;
