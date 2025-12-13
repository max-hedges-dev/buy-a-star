import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GalaxyGenerator from '../utils/GalaxyGenerator';

// Change this number to force galaxy regeneration during development
const GALAXY_VERSION = 9;

const UniverseMap = ({ stars, onSelectStar, targetStar, viewMode, onHoverChange }) => {
    const meshRef = useRef();
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);
    const hoveredInstanceRef = useRef(-1);
    const { camera } = useThree();

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

    // Bulge texture
    const bulgeTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 220, 1)');   // Warm cream
        grad.addColorStop(0.3, 'rgba(255, 245, 160, 0.8)'); // More yellow
        grad.addColorStop(0.6, 'rgba(255, 240, 140, 0.3)'); // Yellow
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

        if (targetStar && viewMode === 'MAP') {
            const targetVec = new THREE.Vector3(targetStar.x, targetStar.y, targetStar.z);
            const offset = targetVec.clone().normalize().multiplyScalar(20);
            const camTargetPos = targetVec.clone().add(offset);
            state.camera.position.lerp(camTargetPos, 0.05);
            state.camera.lookAt(targetVec);
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
            {/* CENTRAL BULGE */}
            <sprite position={[0, 0, 0]} scale={[300, 150, 1]}>
                <spriteMaterial
                    map={bulgeTexture}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    transparent
                    opacity={0.1}
                />
            </sprite>
            <sprite position={[0, 0, 0]} scale={[500, 200, 1]}>
                <spriteMaterial
                    map={bulgeTexture}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    transparent
                    opacity={0.05}
                    color="#DDAA77"
                />
            </sprite>

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
