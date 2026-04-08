import React, { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

import endlessStarsTexture from '../assets/Endless stars in deep space.png';

const SPHERE_RADIUS = 72000;
const TILE_COLUMNS = 3;
const TILE_ROWS = 3;

const GalaxyBackdropSphere = () => {
    const baseTexture = useLoader(THREE.TextureLoader, endlessStarsTexture);
    const stitchedTexture = useMemo(() => {
        const sourceImage = baseTexture.image;
        if (!sourceImage) {
            return baseTexture;
        }

        const canvas = document.createElement('canvas');
        canvas.width = sourceImage.width * TILE_COLUMNS;
        canvas.height = sourceImage.height * TILE_ROWS;

        const context = canvas.getContext('2d');
        if (!context) {
            return baseTexture;
        }

        for (let row = 0; row < TILE_ROWS; row += 1) {
            for (let column = 0; column < TILE_COLUMNS; column += 1) {
                context.drawImage(
                    sourceImage,
                    column * sourceImage.width,
                    row * sourceImage.height,
                    sourceImage.width,
                    sourceImage.height
                );
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = 16;
        texture.repeat.x = -1;
        texture.offset.x = 1;
        texture.needsUpdate = true;
        return texture;
    }, [baseTexture]);

    useEffect(() => {
        if (stitchedTexture === baseTexture) {
            baseTexture.colorSpace = THREE.SRGBColorSpace;
            baseTexture.wrapS = THREE.ClampToEdgeWrapping;
            baseTexture.wrapT = THREE.ClampToEdgeWrapping;
            baseTexture.anisotropy = 16;
            baseTexture.repeat.x = -1;
            baseTexture.offset.x = 1;
            baseTexture.needsUpdate = true;
        }

        return () => {
            if (stitchedTexture !== baseTexture) {
                stitchedTexture.dispose();
            }
        };
    }, [baseTexture, stitchedTexture]);

    return (
        <mesh frustumCulled={false} renderOrder={-20}>
            <sphereGeometry args={[SPHERE_RADIUS, 120, 80]} />
            <meshBasicMaterial
                map={stitchedTexture}
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
