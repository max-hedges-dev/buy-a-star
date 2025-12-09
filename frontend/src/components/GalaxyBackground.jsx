import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Procedurally generate a soft "smoke" texture
const createNebulaTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Gradient for soft cloud
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // Core
    grad.addColorStop(0.4, 'rgba(200, 200, 255, 0.2)'); // Mid
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Edge

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

const GalaxyBackground = ({ count = 300 }) => {
    const texture = useMemo(() => createNebulaTexture(), []);

    // Create random particles in a flattened disk (Milky Way shape)
    const { positions, colors, sizes } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        const colorPalette = [
            new THREE.Color('#4b0082'), // Indigo
            new THREE.Color('#8a2be2'), // BlueViolet
            new THREE.Color('#0000ff'), // Blue
            new THREE.Color('#ff00ff'), // Magenta
            new THREE.Color('#191970')  // MidnightBlue
        ];

        for (let i = 0; i < count; i++) {
            // Spiral-ish distribution or just flattened disk
            const angle = Math.random() * Math.PI * 2;
            const radius = 500 + Math.random() * 2000; // Spread out
            const spreadY = (Math.random() - 0.5) * 400; // Flat disk height

            // Bias towards spiral arms? Let's just do a rich cloud for now.

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = spreadY;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            // Random color from palette
            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

            // Add some variation
            colors[i * 3] = color.r + (Math.random() * 0.2);
            colors[i * 3 + 1] = color.g + (Math.random() * 0.2);
            colors[i * 3 + 2] = color.b + (Math.random() * 0.2);

            // Large variable sizes
            sizes[i] = 200 + Math.random() * 400;
        }

        return { positions, colors, sizes };
    }, [count]);

    return (
        <points raycast={null}> {/* Critical: No interactions */}
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
                <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
            </bufferGeometry>
            {/* Custom shader or PointsMaterial? standard PointsMaterial with vertexColors works well for nebula */}
            <pointsMaterial
                size={1} // Base size (will be overridden by attribute if using shader, but PointsMaterial uses uniform size unless sizeAttenuation)
                // Actually PointsMaterial doesn't support attribute 'size' by default easily without shader injection.
                // Let's use a simpler approach: Just one size? No, clouds need variation.
                // Let's use sizeAttenuation=true and a large uniform size, relying on alpha for depth.
                sizeAttenuation={true}
                vertexColors={true}
                map={texture}
                transparent={true}
                depthWrite={false}
                opacity={0.05} // Very faint!
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
};

export default GalaxyBackground;
