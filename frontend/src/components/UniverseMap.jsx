import React, { useRef, useMemo, useState, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const UniverseMap = ({ stars, onSelectStar, targetStar, viewMode, onHoverChange }) => {
    const meshRef = useRef();
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);
    const hoveredInstanceRef = useRef(-1);
    const { camera } = useThree();


    // Prepare data for InstancedMesh
    useLayoutEffect(() => {
        if (!meshRef.current) return;

        stars.forEach((star, i) => {
            tempObject.position.set(star.x, star.y, star.z);

            // Random scale
            const scale = Math.random() * 2 + 1.5;
            tempObject.scale.set(scale, scale, scale);

            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);

            // Colors - VIBRANT SATURATED COLORS
            if (star.category.includes('Blue')) tempColor.set('#00b7ff'); // Cyan-Blue
            else if (star.category.includes('Red Giant')) tempColor.set('#ff3300'); // Deep Red
            else if (star.category.includes('Red')) tempColor.set('#ff5544'); // Red-Orange
            else if (star.category.includes('White')) tempColor.set('#ffffff'); // Pure White
            else if (star.category.includes('Yellow')) tempColor.set('#ffcc00'); // Golden Yellow
            else tempColor.set('#ffffff');

            meshRef.current.setColorAt(i, tempColor);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [stars, tempObject, tempColor]);

    const shaderMaterial = useMemo(() => {
        // Use MeshStandardMaterial or simulate lighting in Basic?
        // Let's stick to Basic but do the color math correctly in shader.
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            shader.uniforms.hoveredInstance = { value: -1 };

            shader.vertexShader = `
                varying float vInstanceID;
                varying vec3 vPosition;
                ${shader.vertexShader}
             `.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 vInstanceID = float(gl_InstanceID);
                 vPosition = position;
                `
            );

            shader.fragmentShader = `
                uniform float time;
                uniform float hoveredInstance;
                varying float vInstanceID;
                varying vec3 vPosition;
                ${shader.fragmentShader}
             `.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                
                // --- GLINT & VIBRANCY LOGIC ---
                // Randomize phase
                float randomVal = fract(sin(vInstanceID * 12.9898) * 43758.5453);
                
                // Pulse: Modulates INTENSITY, not COLOR saturation
                // 0.8 to 1.3 range
                float pulse = 0.8 + 0.5 * (0.5 + 0.5 * sin(time * 2.0 + randomVal * 6.28));
                
                // Apply pulse to rgb (keeps hue)
                gl_FragColor.rgb *= pulse;
                
                // "Ambient Occlusion / Halo" effect
                // Simple radial gradient on the sphere primitive
                // Center is bright, edges darker (or lighter for halo?)
                // Since it's a sphere, we can use normal-like fake calculation?
                // actually vPosition is local. 
                // Let's make center bright and edges saturated
                
                // float dist = length(vPosition) / 1.5; // normalized radius approx
                // float glow = 1.0 - smoothstep(0.0, 1.0, dist);
                // gl_FragColor.rgb *= (0.5 + 0.5 * glow); 
                
                // --- HOVER LOGIC ---
                float isHover = 1.0 - step(0.1, abs(vInstanceID - hoveredInstance));
                
                // Add white only on hover
                gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 1.0, 1.0), isHover * 0.8);
                
                // If hover, make it extra bright
                if(isHover > 0.5) gl_FragColor.rgb *= 1.5;
                `
            );

            mat.userData.shader = shader;
        };
        return mat;
    }, []);

    useFrame((state, delta) => {
        // Animate shader time
        if (shaderMaterial.userData.shader) {
            shaderMaterial.userData.shader.uniforms.time.value += delta;
            shaderMaterial.userData.shader.uniforms.hoveredInstance.value = hoveredInstanceRef.current;
        }

        // Manual camera zoom towards target if present
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
            const star = stars[e.instanceId];
            onSelectStar(star);
        }
    };

    const handlePointerMove = (e) => {
        if (viewMode !== 'MAP') return;
        e.stopPropagation();

        if (e.instanceId !== undefined) {
            document.body.style.cursor = 'pointer';
            if (hoveredInstanceRef.current !== e.instanceId) {
                hoveredInstanceRef.current = e.instanceId;
                if (onHoverChange) onHoverChange(true);
            }
        } else {
            document.body.style.cursor = 'auto';
            if (hoveredInstanceRef.current !== -1) {
                hoveredInstanceRef.current = -1;
                if (onHoverChange) onHoverChange(false);
            }
        }
    };

    const handlePointerOut = () => {
        document.body.style.cursor = 'auto';
        hoveredInstanceRef.current = -1;
        if (onHoverChange) onHoverChange(false);
    };

    return (
        <group>
            <instancedMesh
                ref={meshRef}
                args={[null, null, stars.length]}
                onClick={handleClick}
                onPointerMove={handlePointerMove}
                onPointerOut={handlePointerOut}
                material={shaderMaterial}
            >
                <sphereGeometry args={[1.5, 16, 16]} />
            </instancedMesh>
        </group>
    );
};

export default UniverseMap;
