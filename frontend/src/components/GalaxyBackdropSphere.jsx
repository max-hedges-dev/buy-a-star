import React, { useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

import endlessStarsTexture from '../assets/Endless stars in deep space.png';

const SPHERE_RADIUS = 18000;

const GalaxyBackdropSphere = () => {
    const texture = useLoader(THREE.TextureLoader, endlessStarsTexture);

    useEffect(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.repeat.x = -1;
        texture.offset.x = 1;
        texture.anisotropy = 8;
        texture.needsUpdate = true;
    }, [texture]);

    return (
        <mesh frustumCulled={false} renderOrder={-20}>
            <sphereGeometry args={[SPHERE_RADIUS, 72, 48]} />
            <meshBasicMaterial
                map={texture}
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
