import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import UniverseMap from './UniverseMap';
import GalaxyBackdropSphere from './GalaxyBackdropSphere';
import GalaxyBackground from './GalaxyBackground';

const DEFAULT_CAM_POS = new THREE.Vector3(0, 800, 2400);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const MIN_DIST = 5;
const MAX_DIST = 4200;
const IDLE_TIMEOUT = 10000;
const CAMERA_SETTINGS = { position: [0, 800, 2400], fov: 60, far: 100000 };

const MAP_MODE = 'MAP';

const IdleController = ({ galaxyRef, lastInteractionRef, isHoveringStar, viewMode }) => {
    const { camera } = useThree();
    const isIdle = useRef(true);

    const defaultQuat = useMemo(() => {
        const cam = new THREE.PerspectiveCamera();
        cam.position.copy(DEFAULT_CAM_POS);
        cam.lookAt(DEFAULT_TARGET);
        return cam.quaternion.clone();
    }, []);

    useFrame((state, delta) => {
        if (viewMode !== MAP_MODE || !galaxyRef.current) return;

        if (isHoveringStar) {
            lastInteractionRef.current = Date.now();
            isIdle.current = false;
            return;
        }

        const timeSince = Date.now() - lastInteractionRef.current;
        isIdle.current = timeSince > IDLE_TIMEOUT;

        if (isIdle.current) {
            galaxyRef.current.rotation.y += delta * 0.08;
            galaxyRef.current.rotation.x *= 0.97;
            galaxyRef.current.position.lerp(DEFAULT_TARGET, 0.03);
            camera.position.lerp(DEFAULT_CAM_POS, 0.02);
            camera.quaternion.slerp(defaultQuat, 0.02);
        }
    });

    return null;
};

const GalaxyDragger = ({ galaxyRef, lastInteractionRef, viewMode }) => {
    const { gl, camera } = useThree();

    useEffect(() => {
        if (viewMode !== MAP_MODE) return undefined;
        const canvas = gl.domElement;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        const onDown = (event) => {
            if (event.button !== 0) return;
            isDragging = true;
            lastX = event.clientX;
            lastY = event.clientY;
            lastInteractionRef.current = Date.now();
            canvas.style.cursor = 'grabbing';
        };

        const onMove = (event) => {
            if (!isDragging || !galaxyRef.current) return;
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;

            const cameraElevation = Math.atan2(camera.position.y, camera.position.z);
            const effectiveAngle = Math.abs(cameraElevation + galaxyRef.current.rotation.x);
            const ratio = THREE.MathUtils.clamp(effectiveAngle / 0.35, 0, 1);
            const sensitivityScale = Math.max(ratio * ratio, 0.02);

            galaxyRef.current.rotation.y += dx * 0.004 * sensitivityScale;

            const newTilt = galaxyRef.current.rotation.x + dy * 0.003 * sensitivityScale;
            galaxyRef.current.rotation.x = THREE.MathUtils.clamp(newTilt, -Math.PI / 3, Math.PI / 3);

            lastX = event.clientX;
            lastY = event.clientY;
            lastInteractionRef.current = Date.now();
        };

        const onUp = () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        };

        canvas.style.cursor = 'grab';
        canvas.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            canvas.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            canvas.style.cursor = '';
        };
    }, [camera, galaxyRef, gl, lastInteractionRef, viewMode]);

    return null;
};

const ZoomToPointer = ({ galaxyRef, lastInteractionRef, viewMode }) => {
    const { camera, gl, raycaster } = useThree();
    const targetPos = useRef(null);
    const targetQuat = useRef(null);
    const lastWheelTime = useRef(0);
    const zoomPlane = useRef(new THREE.Plane());
    const planeNormal = useRef(new THREE.Vector3());
    const planePoint = useRef(new THREE.Vector3());
    const zoomAnchor = useRef(new THREE.Vector3());
    const galaxyQuat = useRef(new THREE.Quaternion());
    const anchorDir = useRef(new THREE.Vector3());
    const planeOffset = useRef(new THREE.Vector3());

    const defaultQuat = useMemo(() => {
        const cam = new THREE.PerspectiveCamera();
        cam.position.copy(DEFAULT_CAM_POS);
        cam.lookAt(DEFAULT_TARGET);
        return cam.quaternion.clone();
    }, []);

    useFrame((state, delta) => {
        if (viewMode !== MAP_MODE) return;

        if (!targetPos.current) {
            targetPos.current = state.camera.position.clone();
            targetQuat.current = state.camera.quaternion.clone();
        }

        if (Date.now() - lastWheelTime.current < 400) {
            state.camera.position.lerp(targetPos.current, 10 * delta);
            state.camera.quaternion.slerp(targetQuat.current, 10 * delta);
        } else {
            targetPos.current.copy(state.camera.position);
            targetQuat.current.copy(state.camera.quaternion);
        }
    });

    useEffect(() => {
        if (viewMode !== MAP_MODE) return undefined;

        const canvas = gl.domElement;
        const handleWheel = (event) => {
            event.preventDefault();
            lastInteractionRef.current = Date.now();
            lastWheelTime.current = Date.now();

            if (!targetPos.current) return;

            const zoomingIn = event.deltaY < 0;
            let planeDistance = Math.max(targetPos.current.y, 1);
            let planeSide = 1;

            if (galaxyRef.current) {
                galaxyRef.current.updateWorldMatrix(true, false);
                galaxyRef.current.getWorldPosition(planePoint.current);
                planeNormal.current
                    .set(0, 1, 0)
                    .applyQuaternion(galaxyRef.current.getWorldQuaternion(galaxyQuat.current))
                    .normalize();
                zoomPlane.current.setFromNormalAndCoplanarPoint(planeNormal.current, planePoint.current);

                const signedPlaneDistance = zoomPlane.current.distanceToPoint(targetPos.current);
                planeSide = Math.sign(signedPlaneDistance) || 1;
                planeDistance = Math.max(Math.abs(signedPlaneDistance), 1);
            }

            const moveSpeed = Math.max(planeDistance * 0.15, 5);

            if (zoomingIn) {
                const rect = canvas.getBoundingClientRect();
                const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                const mouseNDC = new THREE.Vector2(ndcX, ndcY);

                raycaster.setFromCamera(mouseNDC, camera);
                const rayDir = raycaster.ray.direction.clone().normalize();

                let anchoredZoom = false;
                if (galaxyRef.current && raycaster.ray.intersectPlane(zoomPlane.current, zoomAnchor.current)) {
                    anchorDir.current.copy(zoomAnchor.current).sub(targetPos.current);
                    const distanceToAnchor = anchorDir.current.length();

                    if (distanceToAnchor > MIN_DIST) {
                        const step = Math.min(moveSpeed, distanceToAnchor - MIN_DIST);
                        targetPos.current.addScaledVector(anchorDir.current.normalize(), step);
                        anchoredZoom = true;
                    }
                }

                if (!anchoredZoom) {
                    targetPos.current.addScaledVector(rayDir, moveSpeed);
                }

                if (galaxyRef.current) {
                    const nextPlaneDistance = zoomPlane.current.distanceToPoint(targetPos.current);
                    if (nextPlaneDistance * planeSide < 0.5) {
                        planeOffset.current.copy(planeNormal.current).multiplyScalar((planeSide * 0.5) - nextPlaneDistance);
                        targetPos.current.add(planeOffset.current);
                    }
                } else {
                    targetPos.current.y = Math.max(targetPos.current.y, 0.5);
                }
            } else {
                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);
                targetPos.current.addScaledVector(forward, -moveSpeed);

                if (planeDistance > 50) {
                    const blendFactor = Math.min((planeDistance - 50) / 1000, 0.15);
                    targetPos.current.lerp(DEFAULT_CAM_POS, blendFactor);
                    targetQuat.current.slerp(defaultQuat, blendFactor);

                    if (galaxyRef.current) {
                        galaxyRef.current.rotation.x *= (1 - blendFactor);
                        galaxyRef.current.position.lerp(DEFAULT_TARGET, blendFactor);
                    }
                }
            }

            if (targetPos.current.length() > MAX_DIST) {
                targetPos.current.copy(DEFAULT_CAM_POS);
                targetQuat.current.copy(defaultQuat);
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [camera, defaultQuat, galaxyRef, gl, lastInteractionRef, raycaster, viewMode]);

    return null;
};

const GalaxyMapLayer = ({
    canRenderGalaxyScene,
    forceTooltipStar,
    galaxyGroupRef,
    handleGalaxyBackdropReady,
    handleGalaxyMapReady,
    isHoveringStar,
    lastInteractionRef,
    macroFlyInMode,
    onSelectStar,
    setIsHoveringStar,
    shouldShowMapLayer,
    stars,
    targetStar,
    targetZoomScale,
    viewMode,
}) => {
    const controlsRef = useRef();

    return (
        <Canvas camera={CAMERA_SETTINGS}>
            <color attach="background" args={['#050505']} />
            <ambientLight intensity={0.5} />

            <IdleController
                galaxyRef={galaxyGroupRef}
                lastInteractionRef={lastInteractionRef}
                isHoveringStar={isHoveringStar}
                viewMode={viewMode}
            />

            <GalaxyDragger
                galaxyRef={galaxyGroupRef}
                lastInteractionRef={lastInteractionRef}
                viewMode={viewMode}
            />

            <ZoomToPointer
                galaxyRef={galaxyGroupRef}
                lastInteractionRef={lastInteractionRef}
                viewMode={viewMode}
            />

            <group ref={galaxyGroupRef}>
                <GalaxyBackdropSphere onReady={handleGalaxyBackdropReady} />
                <GalaxyBackground count={400} />

                {canRenderGalaxyScene && shouldShowMapLayer && (
                    <UniverseMap
                        stars={stars}
                        viewMode={viewMode}
                        onSelectStar={onSelectStar}
                        targetStar={targetStar}
                        targetZoomScale={targetZoomScale}
                        onHoverChange={setIsHoveringStar}
                        forceTooltipStar={forceTooltipStar}
                        macroFlyInMode={macroFlyInMode}
                        onReady={handleGalaxyMapReady}
                    />
                )}
            </group>

            <OrbitControls
                ref={controlsRef}
                enablePan={false}
                enableZoom={false}
                enableRotate={false}
                enabled={false}
            />
        </Canvas>
    );
};

export default GalaxyMapLayer;
