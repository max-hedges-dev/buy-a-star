import * as THREE from 'three';

/**
 * Galaxy Generator - Tighter & Thicker
 * Increased Spin and Randomness for requested look.
 */
class GalaxyGenerator {
    constructor(parameters = {}) {
        this.params = {
            count: 80000,          // Increased for density
            arms: 2,
            radius: 2000,
            coreRadiusX: 250,
            coreRadiusZ: 100,
            spin: 12,              // Tighter (Was 8)
            randomness: 1.2,       // Thicker (Was 0.9)
            insideColor: '#aa8866',
            outsideColor: '#4488ff',
            ...parameters
        };
    }

    generateGalaxy() {
        const positions = new Float32Array(this.params.count * 3);
        const colors = new Float32Array(this.params.count * 3);
        const scales = new Float32Array(this.params.count);

        const colorInside = new THREE.Color(this.params.insideColor);
        const colorOutside = new THREE.Color(this.params.outsideColor);

        for (let i = 0; i < this.params.count; i++) {
            const isCore = Math.random() < 0.2;

            let x, y, z;
            let mixedColor;

            if (isCore) {
                // --- DIM OVAL CORE ---
                const theta = Math.random() * Math.PI * 2;
                const r = Math.pow(Math.random(), 0.5);

                x = r * Math.cos(theta) * this.params.coreRadiusX;
                z = r * Math.sin(theta) * this.params.coreRadiusZ;
                y = (Math.random() - 0.5) * (this.params.coreRadiusX * 0.2);

                mixedColor = colorInside.clone().lerp(new THREE.Color('#000000'), 0.3 + Math.random() * 0.3);

            } else {
                // --- ARMS ---
                const r = this.params.coreRadiusX + Math.random() * (this.params.radius - this.params.coreRadiusX);
                const spinAngle = (r - this.params.coreRadiusX) / (this.params.radius - this.params.coreRadiusX) * this.params.spin;
                const armIndex = i % this.params.arms;
                const armAngle = armIndex * Math.PI;
                const finalAngle = spinAngle + armAngle;

                // --- CIRCULAR SCATTER (THICK) ---
                // Power 1.5 allows more spread away from center than Power 2
                const scatterRadius = Math.pow(Math.random(), 1.5) * this.params.randomness * r;
                const scatterAngle = Math.random() * Math.PI * 2;

                const randomX = Math.cos(scatterAngle) * scatterRadius;
                const randomZ = Math.sin(scatterAngle) * scatterRadius;

                x = Math.cos(finalAngle) * r + randomX;
                z = Math.sin(finalAngle) * r + randomZ;
                y = (Math.random() - 0.5) * (r * 0.2); // Thicker vertical too

                // Color Gradient
                mixedColor = colorInside.clone().lerp(colorOutside, r / (this.params.radius * 0.6));

                if (Math.random() < 0.2) mixedColor.lerp(new THREE.Color('#ffffff'), 0.4);
            }

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            colors[i * 3] = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;

            scales[i] = Math.random();
        }

        return { positions, colors, scales };
    }
}

export default new GalaxyGenerator();
export { GalaxyGenerator };
