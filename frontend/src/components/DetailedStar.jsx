import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';
import { getStarAppearance } from '../utils/starAppearance';

const textureCache = new Map();

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
const HERO_SHELL_GEOMETRY = new THREE.SphereGeometry(2, 160, 160);
const HIGH_SURFACE_GEOMETRY = new THREE.SphereGeometry(2, 32, 32);
const MEDIUM_SURFACE_GEOMETRY = new THREE.SphereGeometry(2, 16, 16);
const MEDIUM_SHELL_GEOMETRY = new THREE.SphereGeometry(2, 14, 14);

const HERO_BLOOM_TEXTURE = getRadialTexture('hero-bloom', 256, [
    [0, 'rgba(255,255,255,1)'],
    [0.14, 'rgba(255,255,255,0.92)'],
    [0.36, 'rgba(255,255,255,0.28)'],
    [0.7, 'rgba(255,255,255,0.05)'],
    [1, 'rgba(255,255,255,0)'],
]);

const HIGH_BLOOM_TEXTURE = getRadialTexture('high-bloom', 128, [
    [0, 'rgba(255,255,255,1)'],
    [0.16, 'rgba(255,255,255,0.86)'],
    [0.4, 'rgba(255,255,255,0.22)'],
    [1, 'rgba(255,255,255,0)'],
]);

const MEDIUM_BLOOM_TEXTURE = getRadialTexture('medium-bloom', 96, [
    [0, 'rgba(255,255,255,1)'],
    [0.2, 'rgba(255,255,255,0.72)'],
    [0.55, 'rgba(255,255,255,0.14)'],
    [1, 'rgba(255,255,255,0)'],
]);

const simplexNoise = `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
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

float snoise(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 4; i++) {
    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value * 2.0 - 1.0;
}
`;

const StarSurfaceMaterial = shaderMaterial(
    {
        time: 0,
        baseColor: new THREE.Color('#33a1ff'),
        hotColor: new THREE.Color('#e6f7ff'),
        animate: 1.0,
        hotCore: 0.5,
    },
    `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
    `
    uniform float time;
    uniform vec3 baseColor;
    uniform vec3 hotColor;
    uniform float animate;
    uniform float hotCore;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    ${simplexNoise}

    void main() {
      vec3 n = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float t = time * animate;

      float largeCells = snoise(n * 3.2 + vec3(t * 0.14, t * 0.10, t * 0.08));
      float fineCells = snoise(n.yzx * 8.0 - vec3(t * 0.22, 0.0, t * 0.18));
      float boil = largeCells * 0.6 + fineCells * 0.4;

      float facing = max(dot(n, viewDir), 0.0);
      float limb = pow(1.0 - facing, 1.35);

      vec3 chroma = mix(baseColor * 0.85, hotColor, hotCore + boil * 0.12);
      vec3 surface = mix(chroma, hotColor, pow(facing, 2.1) * 0.38);
      surface += baseColor * (boil * 0.5 + 0.5) * 0.18;
      surface += baseColor * smoothstep(0.25, 0.9, limb) * 0.26;

      gl_FragColor = vec4(surface, 1.0);
    }
  `
);

const CoronaShellMaterial = shaderMaterial(
    {
        time: 0,
        color: new THREE.Color('#66c7ff'),
        animate: 1.0,
        intensity: 1.0,
        flareBias: 0.0,
        displacement: 1.0,
    },
    `
    uniform float time;
    uniform float animate;
    uniform float flareBias;
    uniform float displacement;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying float vFlare;
    varying float vBreakup;
    ${simplexNoise}

    void main() {
      float t = time * animate;
      vec3 dir = normalize(position);
      float broad = snoise(dir * 3.8 + vec3(t * 0.18, t * 0.10, t * 0.14));
      float sharp = snoise(dir.zxy * 9.0 - vec3(t * 0.34, 0.0, t * 0.28));
      float flare = pow(max(sharp + flareBias, 0.0), 2.6);
      float breakup = broad * 0.6 + sharp * 0.4;
      float offset = displacement * (0.05 + broad * 0.018 + flare * 0.11);
      vec3 displaced = position + dir * offset;

      vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vFlare = flare;
      vBreakup = breakup;

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
    `
    uniform vec3 color;
    uniform float intensity;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying float vFlare;
    varying float vBreakup;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.4);
      float breakup = mix(0.78, 1.35, vBreakup * 0.5 + 0.5);
      float alpha = rim * breakup * (0.22 + vFlare * 0.85) * intensity;
      vec3 coronaColor = mix(color, vec3(1.0), min(vFlare * 0.45, 0.5));
      gl_FragColor = vec4(coronaColor, alpha);
    }
  `
);

extend({ StarSurfaceMaterial, CoronaShellMaterial });

export const getStarPalette = (star) => {
    return getStarAppearance(star);
};

const HeroStar = ({ palette, playAnimation = true }) => {
    const surfaceRef = useRef();
    const coronaRef = useRef();
    const flareRef = useRef();
    const bloomRef = useRef();
    const vecPos = useMemo(() => new THREE.Vector3(), []);

    const bloomScale = 7.8;
    const bloomOpacity = 0.26;

    useFrame((state, delta) => {
        const animateValue = playAnimation ? 1.0 : 0.0;
        if (surfaceRef.current) {
            if (playAnimation) surfaceRef.current.time += delta;
            surfaceRef.current.animate = animateValue;
        }
        if (coronaRef.current) {
            if (playAnimation) coronaRef.current.time += delta;
            coronaRef.current.animate = animateValue;
        }
        if (flareRef.current) {
            if (playAnimation) flareRef.current.time += delta;
            flareRef.current.animate = animateValue;
        }
        if (bloomRef.current) {
            bloomRef.current.getWorldPosition(vecPos);
            const dist = state.camera.position.distanceTo(vecPos);
            const pulse = playAnimation ? 1.0 + Math.sin(state.clock.elapsedTime * 1.4) * 0.02 : 1.0;
            bloomRef.current.scale.setScalar(bloomScale * pulse);
            bloomRef.current.material.opacity = bloomOpacity + (dist > 160 ? 0.03 : 0.0);
        }
    });

    return (
        <group>
            <mesh>
                <primitive object={HERO_SURFACE_GEOMETRY} attach="geometry" />
                <starSurfaceMaterial
                    ref={surfaceRef}
                    baseColor={palette.surface}
                    hotColor={palette.hot}
                    hotCore={palette.hotCore}
                    animate={1.0}
                    transparent={true}
                    depthWrite={false}
                    blending={THREE.NormalBlending}
                />
            </mesh>

            <mesh scale={[1.01, 1.01, 1.01]}>
                <primitive object={HERO_SHELL_GEOMETRY} attach="geometry" />
                <coronaShellMaterial
                    ref={coronaRef}
                    color={palette.corona}
                    animate={1.0}
                    intensity={1.0}
                    flareBias={0.18}
                    displacement={1.25}
                    transparent={true}
                    depthWrite={false}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            <mesh scale={[1.02, 1.02, 1.02]}>
                <primitive object={HERO_SHELL_GEOMETRY} attach="geometry" />
                <coronaShellMaterial
                    ref={flareRef}
                    color={palette.flare}
                    animate={1.0}
                    intensity={0.5}
                    flareBias={0.28}
                    displacement={1.85}
                    transparent={true}
                    depthWrite={false}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            <sprite ref={bloomRef} scale={[bloomScale, bloomScale, 1]}>
                <spriteMaterial
                    map={HERO_BLOOM_TEXTURE}
                    color={palette.bloom}
                    transparent
                    opacity={bloomOpacity}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </sprite>
        </group>
    );
};

const HighStar = ({ palette, playAnimation = true }) => {
    const surfaceRef = useRef();
    const bloomRef = useRef();
    const vecPos = useMemo(() => new THREE.Vector3(), []);

    useFrame((state, delta) => {
        if (surfaceRef.current) {
            if (playAnimation) surfaceRef.current.time += delta;
            surfaceRef.current.animate = playAnimation ? 1.0 : 0.0;
        }
        if (bloomRef.current) {
            bloomRef.current.getWorldPosition(vecPos);
            const dist = state.camera.position.distanceTo(vecPos);
            const pulse = playAnimation ? 1.0 + Math.sin(state.clock.elapsedTime * 1.2) * 0.012 : 1.0;
            bloomRef.current.scale.setScalar(4.7 * pulse);
            bloomRef.current.material.opacity = 0.09 + (dist > 90 ? 0.02 : 0.0);
        }
    });

    return (
        <group>
            <mesh>
                <primitive object={HIGH_SURFACE_GEOMETRY} attach="geometry" />
                <starSurfaceMaterial
                    ref={surfaceRef}
                    baseColor={palette.surface}
                    hotColor={palette.hot}
                    hotCore={palette.hotCore}
                    animate={1.0}
                    transparent={true}
                    depthWrite={false}
                    blending={THREE.NormalBlending}
                />
            </mesh>

            <sprite ref={bloomRef} scale={[4.7, 4.7, 1]}>
                <spriteMaterial
                    map={HIGH_BLOOM_TEXTURE}
                    color={palette.bloom}
                    transparent
                    opacity={0.09}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </sprite>
        </group>
    );
};

const MediumStar = ({ palette }) => {
    return (
        <group>
            <mesh>
                <primitive object={MEDIUM_SURFACE_GEOMETRY} attach="geometry" />
                <meshBasicMaterial color={palette.surface} depthWrite={false} />
            </mesh>

            <mesh scale={[1.008, 1.008, 1.008]}>
                <primitive object={MEDIUM_SHELL_GEOMETRY} attach="geometry" />
                <coronaShellMaterial
                    color={palette.corona}
                    animate={0.0}
                    intensity={0.2}
                    flareBias={-0.1}
                    displacement={0.08}
                    transparent={true}
                    depthWrite={false}
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            <sprite scale={[3.6, 3.6, 1]}>
                <spriteMaterial
                    map={MEDIUM_BLOOM_TEXTURE}
                    color={palette.bloom}
                    transparent
                    opacity={0.06}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </sprite>
        </group>
    );
};

const DetailedStar = ({ star, detailLevel = 'high', playAnimation = true }) => {
    const palette = useMemo(() => getStarPalette(star), [star]);

    if (detailLevel === 'hero') {
        return <HeroStar palette={palette} playAnimation={playAnimation} />;
    }

    if (detailLevel === 'high') {
        return <HighStar palette={palette} playAnimation={playAnimation} />;
    }

    if (detailLevel === 'medium') {
        return <MediumStar palette={palette} />;
    }

    return <HighStar palette={palette} playAnimation={playAnimation} />;
};

export default DetailedStar;
