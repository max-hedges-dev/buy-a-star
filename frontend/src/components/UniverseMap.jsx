import React, { useRef, useMemo, useLayoutEffect, useState, useEffect } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { Html, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import GalaxyGenerator from '../utils/GalaxyGenerator';
import { getStarAppearance } from '../utils/starAppearance';

// Change this number to force galaxy regeneration during development
const GALAXY_VERSION = 31;
const MEDIUM_DETAIL_DISTANCE = 320;
const COLOR_RAMP_START = 55;
const GALAXY_BRIGHTNESS_SCALE = 0.5;

const overlayNoise = `
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
`;

const GalaxyOverlayMaterial = shaderMaterial(
    {
        time: 0,
        baseColor: new THREE.Color('#ffd46c'),
        hotColor: new THREE.Color('#fff8df'),
        colorBlend: 1.0,
    },
    `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    `
    uniform float time;
    uniform vec3 baseColor;
    uniform vec3 hotColor;
    uniform float colorBlend;
    varying vec3 vNormal;
    ${overlayNoise}

    void main() {
      vec3 n = normalize(vNormal);
      float noise = fbm(n * 4.0 + vec3(time * 0.5));
      float facing = max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0);
      float fresnel = 1.0 - facing;

      vec3 body = mix(vec3(1.0), baseColor, colorBlend);
      vec3 hot = mix(vec3(1.0), hotColor, colorBlend);
      vec3 finalColor = body * (1.0 + noise * 0.22);
      finalColor = mix(finalColor, hot, 0.28 + noise * 0.06);
      finalColor += hot * fresnel * 0.22;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ GalaxyOverlayMaterial });

const getGalaxyStarPalette = (star) => getStarAppearance(star);

const GalaxyStarOverlay = ({ star, distSq }) => {
    const materialRef = useRef();
    const palette = useMemo(() => getGalaxyStarPalette(star), [star]);
    const distance = Math.sqrt(distSq);
    const rawBlend = 1 - THREE.MathUtils.smoothstep(distance, COLOR_RAMP_START, MEDIUM_DETAIL_DISTANCE);
    const colorBlend = Math.pow(rawBlend, 3.8);
    const useSimpleWhiteFallback = rawBlend < 0.2;
    const bloomTexture = useMemo(() => {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.72)');
        gradient.addColorStop(0.55, 'rgba(255,255,255,0.14)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }, []);
    const bloomColor = useMemo(
        () => useSimpleWhiteFallback
            ? new THREE.Color('#ffffff')
            : new THREE.Color('#ffffff').lerp(palette.bloom.clone(), Math.pow(rawBlend, 1.6)),
        [palette, rawBlend, useSimpleWhiteFallback]
    );
    const bloomOpacity = useSimpleWhiteFallback ? 0.02 : 0.012 + colorBlend * 0.06;
    const bloomScale = useSimpleWhiteFallback ? 2.8 : 2.4 + colorBlend * 1.2;

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.time = state.clock.elapsedTime;
        }
    });

    return (
        <group>
            {useSimpleWhiteFallback ? (
                <mesh>
                    <sphereGeometry args={[2, 12, 12]} />
                    <meshBasicMaterial color="#ffffff" depthWrite={false} toneMapped={false} />
                </mesh>
            ) : (
                <mesh>
                    <sphereGeometry args={[2, 16, 16]} />
                    <galaxyOverlayMaterial
                        ref={materialRef}
                        baseColor={palette.surface}
                        hotColor={palette.bloom}
                        colorBlend={colorBlend}
                        transparent={true}
                        depthWrite={false}
                        blending={THREE.NormalBlending}
                    />
                </mesh>
            )}

            <sprite scale={[bloomScale, bloomScale, 1]}>
                <spriteMaterial
                    map={bloomTexture}
                    color={bloomColor}
                    transparent
                    opacity={bloomOpacity}
                    depthWrite={false}
                    toneMapped={false}
                    blending={THREE.AdditiveBlending}
                />
            </sprite>
        </group>
    );
};

const UniverseMap = ({ stars, onSelectStar, targetStar, targetZoomScale = 1, viewMode, onHoverChange, forceTooltipStar, macroFlyInMode }) => {
    const meshRef = useRef();
    const groupRef = useRef();
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);
    const hoveredInstanceRef = useRef(-1);
    const [hoveredStar, setHoveredStar] = useState(null);
    const activeHoverStar = forceTooltipStar || hoveredStar;
    const { camera, gl } = useThree();

    // High-poly Local Rendering State
    const nearbyRef = useRef([]);
    const [nearbyStars, setNearbyStars] = useState([]);

    // Generate unified galaxy data - regenerates when GALAXY_VERSION changes
    const galaxyData = useMemo(() => {
        console.log('Regenerating galaxy with version:', GALAXY_VERSION);
        return GalaxyGenerator.generateGalaxy();
    }, [GALAXY_VERSION]);

    // Setup interactive stars (Zero-cost white spheres)
    useLayoutEffect(() => {
        if (!meshRef.current) return;
        stars.forEach((star, i) => {
            tempObject.position.set(star.x, star.y, star.z);
            // Detailed geometry radius = 2, scaled by 0.75 * scaleMulti = 1.5 * scaleMulti.
            // Generic instanced mesh is sphere r=1.5. So scale = scaleMulti.
            // Divided by 5 to drastically increase the perceived scale of the galaxy void.
            const scaleMulti = (0.5 + Math.abs(Math.sin((star.id || i) * 43.21)) * 1.5) / 5.0;
            tempObject.scale.set(scaleMulti, scaleMulti, scaleMulti);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);
            tempColor.set('#ffffff');
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [stars, tempColor, tempObject]);

    const starMaterial = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
    }), []);

    // Soft particle texture
    const cloudTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }, []);

    // Volumetric bulge glow shader materials
    const bulgeGlowMaterials = useMemo(() => {
        const vertexShader = `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const createMaterial = (innerCol, outerCol, intensity, falloff) => {
            return new THREE.ShaderMaterial({
                uniforms: {
                    innerColor: { value: new THREE.Color(innerCol) },
                    outerColor: { value: new THREE.Color(outerCol) },
                    intensity: { value: intensity },
                    falloff: { value: falloff },
                },
                vertexShader,
                fragmentShader: `
                    uniform vec3 innerColor;
                    uniform vec3 outerColor;
                    uniform float intensity;
                    uniform float falloff;
                    varying vec3 vNormal;
                    varying vec3 vViewPosition;
                    void main() {
                        vec3 viewDir = normalize(vViewPosition);
                        float facing = abs(dot(normalize(vNormal), viewDir));
                        // Smooth exponential falloff for soft volumetric glow
                        float glow = pow(facing, falloff);
                        // Soften edges with exponential decay to avoid hard sphere outline
                        float edgeSoftness = smoothstep(0.0, 0.5, facing);
                        vec3 color = mix(outerColor, innerColor, glow);
                        float alpha = glow * edgeSoftness * intensity;
                        gl_FragColor = vec4(color, alpha);
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
        };

        return {
            // Inner bright core - white-yellow center fading to warm orange
            inner: createMaterial('#FFFFF5', '#FFC060', 0.84 * GALAXY_BRIGHTNESS_SCALE, 0.8),
            // Duplicate layer for extra brightness at core center
            innerBright: createMaterial('#FFFFF5', '#FFD080', 0.42 * GALAXY_BRIGHTNESS_SCALE, 0.6),
            // Outer aura - warm amber glow, softer falloff
            outerAura: createMaterial('#DDAA77', '#664422', 0.63 * GALAXY_BRIGHTNESS_SCALE, 1.2),
        };
    }, []);

    // Dummy camera for calculating target rotations without allocating every frame
    const dummyCam = useMemo(() => new THREE.PerspectiveCamera(), []);
    const animRef = useRef(null);
    const lastCheckRef = useRef(0);

    useEffect(() => {
        if (targetStar) {
            // Apply macro jump instantly if requested before starting animation
            if (macroFlyInMode) {
                camera.position.set(0, 800, 2400); 
                camera.lookAt(0, 0, 0); 
            }

            // Calculate destination in absolute world space
            const localPos = new THREE.Vector3(targetStar.x, targetStar.y, targetStar.z);
            let worldPos = localPos.clone();
            if (groupRef.current) {
                groupRef.current.updateWorldMatrix(true, false);
                worldPos.applyMatrix4(groupRef.current.matrixWorld);
            }
            
            // Calculate an offset from the star toward the camera's CURRENT vector
            // This ensures we glide linearly down the pipe we're already looking through!
            let toCamera = camera.position.clone().sub(worldPos);
            if (toCamera.lengthSq() < 0.1) {
                toCamera.set(0, 1, 0); // fallback orientation if inside the star
            }
            toCamera.normalize();
            
            const effectiveZoomScale = THREE.MathUtils.clamp(targetZoomScale, 0.1, 2);
            const endDist = 1.6 / effectiveZoomScale; // Lower zoom scale stops slightly farther away.
            const endOffset = toCamera.multiplyScalar(endDist);
            const endPos = worldPos.clone().add(endOffset);

            // Compute end rotation exactly looking at the star
            dummyCam.position.copy(endPos);
            dummyCam.lookAt(worldPos);
            const endQuat = dummyCam.quaternion.clone();

            animRef.current = {
                startPos: camera.position.clone(),
                startQuat: camera.quaternion.clone(),
                endPos: endPos,
                endQuat: endQuat,
                progress: 0,
                duration: macroFlyInMode ? 3.5 : 3.0 // Properly slowed cinematic pacing
            };
        } else {
            animRef.current = null;
        }
    }, [targetStar, camera, macroFlyInMode, dummyCam, targetZoomScale]);

    useFrame((state, delta) => {
        if (animRef.current && (viewMode === 'MAP' || viewMode === 'TRANSITION')) {
            const anim = animRef.current;
            // Guard against massive frame drops destroying the cinematic sequence
            const safeDelta = Math.min(delta, 0.1);
            anim.progress += safeDelta / anim.duration;
            const t = Math.min(anim.progress, 1);

            // Ease in-out cubic for soft gliding starts and perfectly paced stops
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            
            state.camera.position.copy(anim.startPos).lerp(anim.endPos, ease);
            state.camera.quaternion.copy(anim.startQuat).slerp(anim.endQuat, ease);
        }

        // --- Proximity LOD Spawner ---
        if ((viewMode === 'MAP' || viewMode === 'TRANSITION') && state.clock.elapsedTime - lastCheckRef.current > 0.25) {
            lastCheckRef.current = state.clock.elapsedTime;
            const localCamPos = new THREE.Vector3().copy(state.camera.position);
            if (groupRef.current) groupRef.current.worldToLocal(localCamPos);
            
            const threshold = MEDIUM_DETAIL_DISTANCE * MEDIUM_DETAIL_DISTANCE; // Medium LOD range
            
            const closeStars = [];
            for (let i = 0; i < stars.length; i++) {
                const s = stars[i];
                const dx = s.x - localCamPos.x;
                if (dx > 400 || dx < -400) continue;
                const dy = s.y - localCamPos.y;
                if (dy > 400 || dy < -400) continue;
                const dz = s.z - localCamPos.z;
                if (dz > 400 || dz < -400) continue;
                
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq < threshold) closeStars.push({ star: s, distSq });
            }
            closeStars.sort((a, b) => a.distSq - b.distSq);
            const nearestStars = closeStars.slice(0, 60);
            
            let changed = nearestStars.length !== nearbyRef.current.length;
            if (!changed) {
                nearestStars.some((entry, i) => {
                    const prevEntry = nearbyRef.current[i];
                    const prevStar = prevEntry?.star || prevEntry;
                    if (!prevStar || entry.star.id !== prevStar.id) changed = true;
                    return changed;
                });
            }
            if (changed) { nearbyRef.current = nearestStars; setNearbyStars(nearestStars); }
        }
    });

    const handleClick = (e) => {
        if (viewMode !== 'MAP') return;
        e.stopPropagation();
        if (e.instanceId !== undefined) onSelectStar(stars[e.instanceId]);
    };
    const handlePointerMove = (e) => {
        if (viewMode !== 'MAP') return;
        e.stopPropagation();
        if (e.instanceId !== undefined) {
            gl.domElement.style.cursor = 'pointer';
            hoveredInstanceRef.current = e.instanceId;
            const star = stars[e.instanceId];
            if (!hoveredStar || hoveredStar.id !== star.id) setHoveredStar(star);
            if (onHoverChange) onHoverChange(true);
        }
    };
    const handlePointerOut = () => { gl.domElement.style.cursor = 'grab'; hoveredInstanceRef.current = -1; setHoveredStar(null); if (onHoverChange) onHoverChange(false); };

    return (
        <group ref={groupRef}>
            {/* CENTRAL BULGE - 3D Ellipsoid */}
            {/* Sphere scaled to ellipsoid: XZ cross-section matches original plane dimensions */}
            {/* Y axis provides the visible vertical bulge from side view */}
            <mesh position={[0, 0, 0]} scale={[374, 240, 207]} material={bulgeGlowMaterials.inner}>
                <sphereGeometry args={[1, 32, 24]} />
            </mesh>
            {/* Duplicate inner layer for extra core brightness */}
            <mesh position={[0, 0, 0]} scale={[374, 240, 207]} material={bulgeGlowMaterials.innerBright}>
                <sphereGeometry args={[1, 32, 24]} />
            </mesh>
            {/* Outer aura - larger ellipsoid with warm amber glow */}
            <mesh position={[0, 0, 0]} scale={[430, 275, 240]} material={bulgeGlowMaterials.outerAura}>
                <sphereGeometry args={[1, 32, 24]} />
            </mesh>

            {/* UNIFIED CLOUD - One layer, brightness varies by arm proximity */}
            <points raycast={null}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={galaxyData.cloud.positions.length / 3}
                        array={galaxyData.cloud.positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={galaxyData.cloud.colors.length / 3}
                        array={galaxyData.cloud.colors}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    map={cloudTexture}
                    size={200}
                    sizeAttenuation={true}
                    vertexColors={true}
                    transparent={true}
                    opacity={0.04 * GALAXY_BRIGHTNESS_SCALE}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* HII REGIONS */}
            <points raycast={null}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={galaxyData.hii.positions.length / 3}
                        array={galaxyData.hii.positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={galaxyData.hii.colors.length / 3}
                        array={galaxyData.hii.colors}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    map={cloudTexture}
                    size={40}
                    sizeAttenuation={true}
                    vertexColors={true}
                    transparent={true}
                    opacity={0.15 * GALAXY_BRIGHTNESS_SCALE}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* INTERACTIVE STARS */}
            <instancedMesh
                ref={meshRef}
                args={[null, null, stars.length]}
                onClick={handleClick}
                onPointerMove={handlePointerMove}
                onPointerOut={handlePointerOut}
                material={starMaterial}
            >
                <sphereGeometry args={[1.5, 8, 8]} />
            </instancedMesh>

            {/* High-Poly Proximity Overlays (Replaces white meshes completely seamlessly) */}
            {(viewMode === 'MAP' || viewMode === 'TRANSITION') && nearbyStars.map((entry, i) => {
                const star = entry?.star || entry;
                const distSq = entry?.distSq ?? Infinity;
                if (!star) return null;
                const seed = (star.id && typeof star.id === 'number') ? star.id : i;
                // Divided by 5 functionally syncing with the instanced proxy.
                const scaleMulti = (0.5 + Math.abs(Math.sin(seed * 43.21)) * 1.5) / 5.0;
                // Detailed Star is 5% larger than generic shell to perfectly swallow any Z-Fighting overlap.
                const finalScale = 0.75 * scaleMulti * 1.05; 
                return (
                    <group 
                        key={star.id} 
                        position={[star.x, star.y, star.z]} 
                        scale={[finalScale, finalScale, finalScale]}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelectStar(star);
                        }}
                        onPointerMove={(e) => {
                            e.stopPropagation();
                            gl.domElement.style.cursor = 'pointer';
                            if (!hoveredStar || hoveredStar.id !== star.id) {
                                setHoveredStar(star);
                            }
                            if (onHoverChange) onHoverChange(true);
                        }}
                        onPointerOut={() => {
                            gl.domElement.style.cursor = 'grab';
                            setHoveredStar(null);
                            if (onHoverChange) onHoverChange(false);
                        }}
                    >
                        <GalaxyStarOverlay star={star} distSq={distSq} />
                    </group>
                );
            })}

            {/* HOVER TOOLTIP */}
            {activeHoverStar && viewMode === 'MAP' && (
                <Html
                    position={[activeHoverStar.x, activeHoverStar.y, activeHoverStar.z]}
                    style={{ pointerEvents: 'none' }}
                    zIndexRange={[100, 0]}
                >
                    <div style={{
                        position: 'absolute',
                        bottom: '15px',
                        left: '15px',
                        pointerEvents: 'none'
                    }}>
                        {/* Diagonal SVG line connecting origin (star) to tooltip bottom-left */}
                        <svg style={{
                            position: 'absolute',
                            left: '-15px',
                            bottom: '-15px',
                            width: '15px', height: '15px',
                            overflow: 'visible'
                        }}>
                            <line x1="0" y1="15" x2="15" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
                        </svg>

                        <div style={{
                            background: activeHoverStar.is_bought ? 'rgba(0,0,0,0.85)' : 'rgba(20,20,30,0.8)',
                            backdropFilter: 'blur(5px)',
                            padding: '10px 15px',
                            borderRadius: '8px',
                            border: `1px solid ${activeHoverStar.is_bought ? 'rgba(100,100,100,0.5)' : 'rgba(255,255,255,0.2)'}`,
                            color: 'white',
                            width: 'max-content',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '2px', fontFamily: 'serif' }}>
                                {activeHoverStar.common_name || activeHoverStar.scientific_name}
                            </div>
                            {activeHoverStar.is_bought ? (
                                <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>
                                    Owned by: <span style={{ color: 'white', fontWeight: 'bold' }}>{activeHoverStar.owner_name}</span>
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.85rem', color: '#88cc88', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                    CLAIMABLE
                                </div>
                            )}
                        </div>
                    </div>
                </Html>
            )}
        </group>
    );
};

export default UniverseMap;
