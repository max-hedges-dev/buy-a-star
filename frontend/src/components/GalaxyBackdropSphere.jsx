import React, { useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import endlessStarsTexture from '../assets/Endless stars in deep space.png';

const SPHERE_RADIUS = 72000;
const TILE_COLUMNS = 3;
const TILE_ROWS = 3;
const SAFE_TEXTURE_WIDTH = 2048;
const SAFE_TEXTURE_HEIGHT = 1024;

const GalaxyBackdropSphere = ({ onReady }) => {
    const { gl } = useThree();
    const baseTexture = useLoader(THREE.TextureLoader, endlessStarsTexture);
    const safeTexture = useMemo(() => {
        const sourceImage = baseTexture.image;
        if (!sourceImage) {
            return baseTexture;
        }

        const canvas = document.createElement('canvas');
        canvas.width = SAFE_TEXTURE_WIDTH;
        canvas.height = SAFE_TEXTURE_HEIGHT;

        const context = canvas.getContext('2d');
        if (!context) {
            return baseTexture;
        }

        context.drawImage(sourceImage, 0, 0, SAFE_TEXTURE_WIDTH, SAFE_TEXTURE_HEIGHT);
        return new THREE.CanvasTexture(canvas);
    }, [baseTexture]);

    useEffect(() => {
        safeTexture.colorSpace = THREE.SRGBColorSpace;
        safeTexture.wrapS = THREE.RepeatWrapping;
        safeTexture.wrapT = THREE.RepeatWrapping;
        safeTexture.repeat.set(-TILE_COLUMNS, TILE_ROWS);
        safeTexture.offset.set(1, 0);
        safeTexture.minFilter = THREE.LinearMipmapLinearFilter;
        safeTexture.magFilter = THREE.LinearFilter;
        safeTexture.generateMipmaps = true;
        safeTexture.anisotropy = Math.min(6, gl.capabilities.getMaxAnisotropy?.() || 6);
        safeTexture.needsUpdate = true;
        onReady?.();

        return () => {
            if (safeTexture !== baseTexture) {
                safeTexture.dispose();
            }
        };
    }, [baseTexture, safeTexture, gl, onReady]);

    return (
        <mesh frustumCulled={false} renderOrder={-20}>
            <sphereGeometry args={[SPHERE_RADIUS, 120, 80]} />
            <meshBasicMaterial
                map={safeTexture}
                side={THREE.BackSide}
                transparent
                opacity={0.96}
                depthWrite={false}
                toneMapped={false}
                fog={false}
            />
        </mesh>
    );
};

export default GalaxyBackdropSphere;
