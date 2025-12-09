import * as THREE from 'three';

/**
 * Galaxy Generator - Photorealistic Version (Restored)
 * Generates coordinate data for a multi-layered spiral galaxy.
 */
class GalaxyGenerator {
    constructor() {
        this.baseParams = {
            count: 80000,
            arms: 6,
            radius: 1300,
            spin: 6,
            randomness: 0.6,
            randomnessPower: 3,
            coreRadius: 200,
        };
    }

    /*
     * Generates a complex color for a particle based on radius and randomness.
     * Pallete:
     * - Core: White/Yellow/Warm (#fff8e7)
     * - Inner Arms: Rusty/Orange/Brown (#ff8c00 -> #8b4500)
     * - Outer Arms: Blue/Purple/Cyan (#4169e1 -> #00bfff)
     * - Dust Darkeners: Some particles are darker to simulate depth
     */
    getGalaxyColor(r, maxR, randomVal) {
        const ratio = r / maxR;
        const color = new THREE.Color();

        if (ratio < 0.15) {
            // CORE: Bright Yellow/White
            color.setHSL(0.12, 0.8, 0.8 + (Math.random() * 0.2));
        } else if (ratio < 0.45) {
            // INNER ARMS: Rusty/Red/Orange (Dust heavy)
            // HSL: Orange/Red is around 0.05 - 0.08
            color.setHSL(0.05 + Math.random() * 0.05, 0.9, 0.5 + (Math.random() * 0.2));
        } else {
            // OUTER ARMS: Blue/Purple/White
            // HSL: Blue is 0.6
            color.setHSL(0.6 + Math.random() * 0.1, 0.8, 0.5 + (Math.random() * 0.4));
        }

        // Variation: Make some particles darker (Dust effect)
        // If we can't do subtractive blending, we just make them dark red/brown
        if (Math.random() > 0.8) {
            color.setHSL(0.02, 0.9, 0.2); // Dark brown
        }

        return color;
    }

    generate() {
        const params = this.baseParams;
        const positions = new Float32Array(params.count * 3);
        const colors = new Float32Array(params.count * 3);
        const sizes = new Float32Array(params.count);

        for (let i = 0; i < params.count; i++) {
            // Logarithmic Spiral Math
            const r = Math.pow(Math.random(), 1.5) * params.radius;
            const spinAngle = r * params.spin / params.radius;
            const branchAngle = (i % params.arms) / params.arms * Math.PI * 2;

            // Randomness with "clumping" 
            const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;
            const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * (r / 3);
            const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * r;

            const finalAngle = spinAngle + branchAngle;

            positions[i * 3] = Math.cos(finalAngle) * r + randomX;
            positions[i * 3 + 1] = randomY;
            positions[i * 3 + 2] = Math.sin(finalAngle) * r + randomZ;

            // Colors
            const color = this.getGalaxyColor(r, params.radius, Math.random());
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            sizes[i] = Math.random();
        }

        return { positions, colors, sizes };
    }
}

export default new GalaxyGenerator();
