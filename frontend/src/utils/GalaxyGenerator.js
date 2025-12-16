import * as THREE from 'three';

/**
 * Galaxy Generator - v6 Gentle Center Thinning
 * 
 * Fix: Reverted to cloudy look. Only gentle rejection at very center.
 */
class GalaxyGenerator {
    constructor(parameters = {}) {
        this.params = {
            radius: 1500,

            arms: 4,
            spin: 0.55,

            bulgeRadiusX: 250,
            bulgeRadiusZ: 100,

            cloudCount: 100000,
            hiiCount: 600,

            baseColor: '#5566AA',
            armColor: '#AACCFF', // Balanced pale blue
            bulgeColor: '#FFFFCC',  // Light yellow
            hiiColor: '#CC5577',

            ...parameters
        };
    }

    isPrimaryArm(armIndex) {
        return armIndex === 0 || armIndex === 2;
    }

    getSpiralAngleAtRadius(armIndex, r) {
        const { arms, spin, bulgeRadiusX, radius } = this.params;
        const t = Math.max(0, (r - bulgeRadiusX) / (radius - bulgeRadiusX));
        const armOffset = (armIndex / arms) * Math.PI * 2;
        return armOffset + t * spin * Math.PI * 2;
    }

    getArmInfo(x, z) {
        const { arms, bulgeRadiusX, radius } = this.params;

        const r = Math.sqrt(x * x + z * z);

        if (r < bulgeRadiusX) {
            return { distance: 0, nearestArm: 0, inBulge: true };
        }

        const pointAngle = Math.atan2(z, x);

        let minAngularDist = Infinity;
        let nearestArm = 0;

        for (let i = 0; i < arms; i++) {
            const armAngle = this.getSpiralAngleAtRadius(i, r);

            let angularDist = pointAngle - armAngle;
            while (angularDist > Math.PI) angularDist -= Math.PI * 2;
            while (angularDist < -Math.PI) angularDist += Math.PI * 2;
            angularDist = Math.abs(angularDist);

            if (angularDist < minAngularDist) {
                minAngularDist = angularDist;
                nearestArm = i;
            }
        }

        const maxAngularDist = Math.PI / arms;
        return {
            distance: Math.min(minAngularDist / maxAngularDist, 1),
            nearestArm,
            inBulge: false
        };
    }

    getBulgePosition() {
        const { bulgeRadiusX, bulgeRadiusZ } = this.params;

        const theta = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.5);

        const x = Math.cos(theta) * r * bulgeRadiusX;
        const z = Math.sin(theta) * r * bulgeRadiusZ;
        const y = (Math.random() - 0.5) * bulgeRadiusZ * 0.4;

        return { x, y, z };
    }

    generateCloud() {
        const { cloudCount, radius, bulgeRadiusX } = this.params;
        const positions = [];
        const colors = [];

        const baseColor = new THREE.Color(this.params.baseColor);
        const armColor = new THREE.Color(this.params.armColor);
        const bulgeColor = new THREE.Color(this.params.bulgeColor);

        let attempts = 0;
        let placed = 0;
        const maxAttempts = cloudCount * 3;

        while (placed < cloudCount && attempts < maxAttempts) {
            attempts++;

            // Disable bulge particles - rely on sprite for center
            const inBulge = false;  // Reduced from 15% to 5%

            let x, y, z;
            let color;

            if (inBulge) {
                const pos = this.getBulgePosition();
                x = pos.x;
                y = pos.y;
                z = pos.z;

                color = bulgeColor.clone();
                color.multiplyScalar(0.05);  // 5% brightness
                const dist = Math.sqrt(x * x + z * z) / bulgeRadiusX;
                color.lerp(new THREE.Color('#332211'), dist * 0.5);

                positions.push(x, y, z);
                colors.push(color.r, color.g, color.b);
                placed++;
            } else {
                const angle = Math.random() * Math.PI * 2;
                const rNorm = Math.pow(Math.random(), 0.6);
                const r = bulgeRadiusX + rNorm * (radius * 1.3 - bulgeRadiusX);

                x = Math.cos(angle) * r;
                z = Math.sin(angle) * r;

                const armInfo = this.getArmInfo(x, z);
                const armDist = armInfo.distance;
                const isPrimary = this.isPrimaryArm(armInfo.nearestArm);

                const radiusFraction = r / radius;

                // Arm tolerance - even tighter near center (0.05) expanding to edge
                const baseArmTolerance = isPrimary ? 0.5 : 0.35;
                const armTolerance = 0.05 + (baseArmTolerance - 0.05) * Math.min(radiusFraction * 1.5, 1);

                let keepProbability = 1.0;
                const armPenalty = armDist / armTolerance;

                // INNER REGION (0-60%): moderate armPenalty-based rejection for thinner arms
                if (radiusFraction < 0.6) {
                    keepProbability = Math.max(0.5, 1 - armPenalty * 0.25);
                }

                // Edge rejection logic - preventing total black out
                if (radiusFraction > 0.6) {
                    const edgeProgress = (radiusFraction - 0.6) / 0.7;
                    // Lower the penalty to allow some 'mist' to remain
                    // Changed max(0, ...) to max(0.15, ...) to keep background dust
                    keepProbability *= Math.max(0.15, 1 - edgeProgress * armPenalty * 1.5);
                    keepProbability *= 0.5 + Math.random() * 0.5;
                }

                if (Math.random() > keepProbability) {
                    continue;
                }

                y = (Math.random() - 0.5) * 50 * (1 - Math.min(r / radius, 1));

                color = armColor.clone().lerp(baseColor, armDist * 0.8);

                // Inter-arm "void" color handling
                // If far from arm, blend towards a uniform deep blue to fill gaps
                if (armDist > 0.4) {
                    const voidColor = new THREE.Color('#446699'); // Brighter uniform blue
                    const voidMix = Math.min((armDist - 0.4) * 2.0, 1.0);
                    color.lerp(voidColor, voidMix * 0.9);
                }

                let brightness = 1.0 - armDist * 0.5;

                // Ensure inter-arm particles have a higher minimum brightness
                // This creates the "uniform blue light" effect
                if (armDist > 0.45) {
                    brightness = Math.max(brightness, 0.5);
                }

                if (!isPrimary) {
                    brightness *= 0.6;
                }

                if (radiusFraction > 0.8) {
                    brightness *= 1 - (radiusFraction - 0.8) / 0.5;
                }

                // Global dimming of arms
                brightness *= 0.7;

                // Extra dimming for inner arms to reduce core saturation
                if (radiusFraction < 0.4) {
                    brightness *= 0.6 + (radiusFraction / 0.4) * 0.4; // Fade from 0.6 to 1.0
                }

                color.multiplyScalar(Math.max(0.05, brightness));

                if (Math.random() < 0.08) {
                    color.lerp(new THREE.Color('#FFFFFF'), Math.random() * 0.3);
                }

                positions.push(x, y, z);
                colors.push(color.r, color.g, color.b);
                placed++;
            }
        }

        return {
            positions: new Float32Array(positions),
            colors: new Float32Array(colors)
        };
    }

    generateHII() {
        const { hiiCount, arms, bulgeRadiusX, radius, spin } = this.params;
        const positions = [];
        const colors = [];

        const baseColor = new THREE.Color(this.params.hiiColor);
        const white = new THREE.Color('#FFFFFF');

        for (let i = 0; i < hiiCount; i++) {
            let armIndex;
            if (Math.random() < 0.8) {
                armIndex = Math.random() < 0.5 ? 0 : 2;
            } else {
                armIndex = Math.random() < 0.5 ? 1 : 3;
            }

            const t = 0.15 + Math.random() * 0.6;
            const r = bulgeRadiusX + t * (radius - bulgeRadiusX);

            const armOffset = (armIndex / arms) * Math.PI * 2;
            const spiralAngle = armOffset + t * spin * Math.PI * 2;

            const scatter = 40;
            const scatterAngle = Math.random() * Math.PI * 2;
            const scatterDist = Math.random() * scatter;

            const x = Math.cos(spiralAngle) * r + Math.cos(scatterAngle) * scatterDist;
            const z = Math.sin(spiralAngle) * r + Math.sin(scatterAngle) * scatterDist;
            const y = (Math.random() - 0.5) * 30;

            positions.push(x, y, z);

            const color = baseColor.clone();
            color.lerp(white, Math.random() * 0.3);
            colors.push(color.r, color.g, color.b);
        }

        return {
            positions: new Float32Array(positions),
            colors: new Float32Array(colors)
        };
    }

    generateGalaxy() {
        return {
            cloud: this.generateCloud(),
            hii: this.generateHII()
        };
    }
}

export default new GalaxyGenerator();
export { GalaxyGenerator };
