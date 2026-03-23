import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// Custom Shader for the Star Surface
const StarMaterial = shaderMaterial(
    { time: 0, color: new THREE.Color(1.0, 0.5, 0.0) },
    // Vertex Shader
    `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldP;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
    // Fragment Shader
    `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldP;

    // Simplex Noise (simplified for brevity)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) { 
      const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      // First corner
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;

      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
      vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

      // Permutations
      i = mod289(i); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

      // Gradients: 7x7 points over a square, mapped onto an octahedron.
      // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
      float n_ = 0.142857142857; // 1.0/7.0
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);

      //Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      // Noise based on position and time
      float noise = snoise(vNormal * 4.0 + time * 0.5);
      
      // Base color with noise variation
      vec3 finalColor = color * (1.0 + noise * 0.3);
      
      // Make it brighter at center (fresnel-ish)
      float fresnel = dot(vNormal, vec3(0.0, 0.0, 1.0));
      finalColor += vec3(0.2) * (1.0 - fresnel);

      // Color distance white-balance transition 
      // Fades the true rich color dynamically to pure white starlight proportionally over massive distances
      float dist = distance(cameraPosition, vWorldP);
      float colorMix = smoothstep(80.0, 400.0, dist);
      finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), colorMix);

      // Distance cross-fade for High-poly Shader (Removed per user request for permanent visibility)
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ StarMaterial });

const DetailedStar = ({ star }) => {
    const materialRef = useRef();
    const coreRef = useRef();
    const glow1Ref = useRef();
    const glow2Ref = useRef();
    const vecPos = useMemo(() => new THREE.Vector3(), []);

    useFrame((state, delta) => {
        if (materialRef.current) {
            materialRef.current.time += delta;
        }

        // Apply identical shader cross-fade mathematically to the secondary glowing aura meshes
        if (coreRef.current && glow1Ref.current && glow2Ref.current) {
            coreRef.current.getWorldPosition(vecPos);
            const dist = state.camera.position.distanceTo(vecPos);
            
            // Hermite interpolation preventing the Halos from popping immediately when the LOD instance spawns at 400.
            let t = Math.max(0.0, Math.min(1.0, (dist - 300.0) / (400.0 - 300.0)));
            let smoothFade = 1.0 - (t * t * (3.0 - 2.0 * t));
            
            glow1Ref.current.opacity = 0.06 * smoothFade;
            glow2Ref.current.opacity = 0.03 * smoothFade;
        }
    });

    // Map category to color or use injected color
    let color = new THREE.Color('#ffaa00');
    if (star.baseColor) {
        color = star.baseColor.clone ? star.baseColor.clone() : new THREE.Color(star.baseColor);
    } else if (star.category?.includes('Blue')) {
        color.set('#00aaff');
    } else if (star.category?.includes('Red Giant')) {
        color.set('#ff2200');
    } else if (star.category?.includes('Red Dwarf')) {
        color.set('#ff5533');
    } else if (star.category?.includes('White')) {
        color.set('#ffffff');
    }

    return (
        <group ref={coreRef}>
            {/* Core Star */}
            <mesh>
                <sphereGeometry args={[2, 64, 64]} />
                <starMaterial ref={materialRef} color={color} transparent={true} depthWrite={false} blending={THREE.NormalBlending} />
            </mesh>

            {/* Outer Glow */}
            <mesh scale={[3.5, 3.5, 3.5]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial
                    ref={glow1Ref}
                    color={color}
                    transparent
                    opacity={0.06}
                    side={THREE.BackSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            
            {/* Huge faint aura */}
            <mesh scale={[5, 5, 5]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial
                    ref={glow2Ref}
                    color={color}
                    transparent
                    opacity={0.03}
                    side={THREE.BackSide}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
        </group>
    );
};

export default DetailedStar;
