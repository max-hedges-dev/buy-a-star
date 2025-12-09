import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GalaxyGenerator from '../utils/GalaxyGenerator';

const UniverseMap = ({ stars, onSelectStar, targetStar, viewMode, onHoverChange }) => {
    const meshRef = useRef();
    const nebulaRef = useRef();
    const coreRef = useRef();
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);
    const hoveredInstanceRef = useRef(-1);
    const { camera } = useThree();


    // --- 1. NEBULA / GAS FIELD GENERATION ---
    // This runs once and creates the huge gas cloud structure
    // We generate EXTRA points (50,000) just for the visual gas
    const nebulaData = useMemo(() => {
        const gen = GalaxyGenerator.generateGalaxy();
        // We use the generator's output directly for the nebula points
        return gen;
    }, []);

    // --- 2. INTERACTIVE STARS (Mapped relative to real data OR visual?) ---
    // The user wants the interactive stars to MATCH the gas.
    // Currently, our 'stars' prop comes from the backend seed.
    // Ideally, the backend seed should match this shape.
    // For now, we render the 'stars' as is (assuming we will fixing backend next).

    // SETUP STARS MESH
    useLayoutEffect(() => {
        if (!meshRef.current) return;

        stars.forEach((star, i) => {
            tempObject.position.set(star.x, star.y, star.z);

            // Random scale (Stars are small, sharp points)
            const scale = Math.random() * 0.8 + 0.5;
            tempObject.scale.set(scale, scale, scale);

            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);

            // COLOR PALETTE - Slightly warmer/natural
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

    // --- SHADERS & MATERIALS ---

    // A. Star Shader (Sharp, glinting points)
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
                
                // DISTANCE FADE (Atmosphere)
                float dist = distance(cameraPosition, vWorldPosition);
                float fade = 1.0 - smoothstep(100.0, 2500.0, dist);
                gl_FragColor.a = fade; // Use alpha?

                // TWINKLE
                float randomVal = fract(sin(vInstanceID * 12.9898) * 43758.5453);
                float twinkle = 0.8 + 0.4 * sin(time * 3.0 + randomVal * 10.0);
                gl_FragColor.rgb *= twinkle;

                // HOVER
                float isHover = 1.0 - step(0.1, abs(vInstanceID - hoveredInstance));
                if(isHover > 0.5) {
                    gl_FragColor.rgb = vec3(1.0, 1.0, 1.0); 
                    gl_FragColor.rgb *= 3.0; // Bloom intensity
                }
                `
            );

            mat.userData.shader = shader;
        };
        return mat;
    }, []);

    // B. Nebula Texture (Improved for "Cloud" look)
    const nebulaTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; // Higher res for smoothness
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        // Very soft radial gradient
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        // Bright core, slow fade
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }, []);

    // C. Core Glow Texture (Intense)
    const coreTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
        grad.addColorStop(0, 'rgba(255, 240, 200, 1)'); // Warm White
        grad.addColorStop(0.4, 'rgba(255, 180, 100, 0.3)'); // Orange Glow
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }, []);


    useFrame((state, delta) => {
        if (starMaterial.userData.shader) {
            starMaterial.userData.shader.uniforms.time.value += delta;
            starMaterial.userData.shader.uniforms.hoveredInstance.value = hoveredInstanceRef.current;
        }

        // Camera Logic
        if (targetStar && viewMode === 'MAP') {
            const targetVec = new THREE.Vector3(targetStar.x, targetStar.y, targetStar.z);
            const offset = targetVec.clone().normalize().multiplyScalar(20);
            const camTargetPos = targetVec.clone().add(offset);
            state.camera.position.lerp(camTargetPos, 0.05);
            state.camera.lookAt(targetVec);
        }
    });

    // Interaction (Only on Stars)
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
            document.body.style.cursor = 'pointer';
            hoveredInstanceRef.current = e.instanceId;
            if (onHoverChange) onHoverChange(true);
        }
    };
    const handlePointerOut = () => {
        document.body.style.cursor = 'auto';
        hoveredInstanceRef.current = -1;
        if (onHoverChange) onHoverChange(false);
    };

    return (
        <group>
            {/* 1. THE CORE GLOW (Billboards at center) */}
            <sprite position={[0, 0, 0]} scale={[600, 600, 1]}>
                <spriteMaterial map={coreTexture} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.6} />
            </sprite>
            <sprite position={[0, 0, 0]} scale={[1200, 400, 1]}> {/* Outer Halo */}
                <spriteMaterial map={coreTexture} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.3} color="#ff8c00" />
            </sprite>


            {/* 2. THE NEBULA FIELD (Volumetric Cloud Layer) */}
            <points raycast={null}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={nebulaData.positions.length / 3} array={nebulaData.positions} itemSize={3} />
                    <bufferAttribute attach="attributes-color" count={nebulaData.colors.length / 3} array={nebulaData.colors} itemSize={3} />
                </bufferGeometry>
                <pointsMaterial
                    map={nebulaTexture}
                    size={250}
                    sizeAttenuation={true}
                    vertexColors={true}
                    transparent={true}
                    opacity={0.03} // Restored to 0.03
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* 3. THE INTERACTIVE STARS (Bright Points) */}
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
