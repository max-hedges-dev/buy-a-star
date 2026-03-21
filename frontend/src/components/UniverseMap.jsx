import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GalaxyGenerator from '../utils/GalaxyGenerator';

// Change this number to force galaxy regeneration during development
const GALAXY_VERSION = 29;

const UniverseMap = ({ stars, onSelectStar, targetStar, viewMode, onHoverChange }) => {
    const meshRef = useRef();
    const groupRef = useRef();
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);
    const hoveredInstanceRef = useRef(-1);
    const { camera, gl } = useThree();

    // Generate unified galaxy data - regenerates when GALAXY_VERSION changes
    const galaxyData = useMemo(() => {
        console.log('Regenerating galaxy with version:', GALAXY_VERSION);
        return GalaxyGenerator.generateGalaxy();
    }, [GALAXY_VERSION]);

    // Setup interactive stars
    useLayoutEffect(() => {
        if (!meshRef.current) return;

        stars.forEach((star, i) => {
            tempObject.position.set(star.x, star.y, star.z);
            const scale = Math.random() * 0.8 + 0.5;
            tempObject.scale.set(scale, scale, scale);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);

            if (star.category.includes('Blue')) tempColor.set('#aaccff');
            else if (star.category.includes('Red Giant')) tempColor.set('#ff8866');
            else if (star.category.includes('Red')) tempColor.set('#ffaa88');
            else if (star.category.includes('White')) tempColor.set('#ffffff');
            else if (star.category.includes('Yellow')) tempColor.set('#ffeebb');
            else tempColor.set('#ffffff');

            meshRef.current.setColorAt(i, tempColor);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [stars, tempObject, tempColor]);

    // Star shader
    const starMaterial = useMemo(() => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            shader.uniforms.hoveredInstance = { value: -1 };

            shader.vertexShader = `
                varying float vInstanceID;
                varying vec3 vWorldPosition;
                ${shader.vertexShader}
             `.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 vInstanceID = float(gl_InstanceID);
                 vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
                 vWorldPosition = worldPosition.xyz;
                `
            );

            shader.fragmentShader = `
                uniform float time;
                uniform float hoveredInstance;
                varying float vInstanceID;
                varying vec3 vWorldPosition;
                ${shader.fragmentShader}
             `.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                float dist = distance(cameraPosition, vWorldPosition);
                float fade = 1.0 - smoothstep(100.0, 2500.0, dist);
                gl_FragColor.a = fade;
                float randomVal = fract(sin(vInstanceID * 12.9898) * 43758.5453);
                float twinkle = 0.8 + 0.4 * sin(time * 3.0 + randomVal * 10.0);
                gl_FragColor.rgb *= twinkle;
                float isHover = 1.0 - step(0.1, abs(vInstanceID - hoveredInstance));
                if(isHover > 0.5) {
                    gl_FragColor.rgb = vec3(1.0, 1.0, 1.0); 
                    gl_FragColor.rgb *= 3.0;
                }
                `
            );

            mat.userData.shader = shader;
        };
        return mat;
    }, []);

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
            inner: createMaterial('#FFFFF5', '#FFC060', 0.84, 0.8),
            // Duplicate layer for extra brightness at core center
            innerBright: createMaterial('#FFFFF5', '#FFD080', 0.42, 0.6),
            // Outer aura - warm amber glow, softer falloff
            outerAura: createMaterial('#DDAA77', '#664422', 0.63, 1.2),
        };
    }, []);

    // Dummy camera for calculating target rotations without allocating every frame
    const dummyCam = useMemo(() => new THREE.PerspectiveCamera(), []);

    useFrame((state, delta) => {
        if (starMaterial.userData.shader) {
            starMaterial.userData.shader.uniforms.time.value += delta;
            starMaterial.userData.shader.uniforms.hoveredInstance.value = hoveredInstanceRef.current;
        }

        if (targetStar && viewMode === 'MAP') {
            // Get star's world position (accounting for galaxy group rotation/translation)
            const localPos = new THREE.Vector3(targetStar.x, targetStar.y, targetStar.z);
            let worldPos = localPos;
            if (groupRef.current) {
                worldPos = localPos.clone();
                // Walk up to the parent galaxy group to get world matrix
                groupRef.current.updateWorldMatrix(true, false);
                worldPos.applyMatrix4(groupRef.current.matrixWorld);
            }
            const offset = worldPos.clone().sub(state.camera.position).normalize().multiplyScalar(-20);
            const camTargetPos = worldPos.clone().add(offset);
            
            // Calculate target rotation using the dummy camera
            dummyCam.position.copy(state.camera.position);
            dummyCam.lookAt(worldPos);

            // Interpolate position and rotation smoothly
            state.camera.position.lerp(camTargetPos, 0.05);
            state.camera.quaternion.slerp(dummyCam.quaternion, 0.05);
        }
    });

    const handleClick = (e) => {
        if (viewMode !== 'MAP') return;
        e.stopPropagation();
        if (e.instanceId !== undefined) {
            onSelectStar(stars[e.instanceId]);
        }
    };
    const handlePointerMove = (e) => {
        if (viewMode !== 'MAP') return;
        e.stopPropagation();
        if (e.instanceId !== undefined) {
            gl.domElement.style.cursor = 'pointer';
            hoveredInstanceRef.current = e.instanceId;
            if (onHoverChange) onHoverChange(true);
        }
    };
    const handlePointerOut = () => {
        gl.domElement.style.cursor = 'grab';
        hoveredInstanceRef.current = -1;
        if (onHoverChange) onHoverChange(false);
    };

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
                    opacity={0.04}
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
                    opacity={0.15}
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
        </group>
    );
};

export default UniverseMap;
