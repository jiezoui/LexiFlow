import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { createNoise3D } from 'simplex-noise';
import {
  surfaceVertexShader,
  surfaceFragmentShader,
  rimVertexShader,
  rimFragmentShader,
  innerVertexShader,
  innerFragmentShader,
  dustVertexShader,
  dustFragmentShader,
} from './globeShaders';

interface GlobeCanvasProps {
  parallaxX: number;
  parallaxY: number;
}

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({ parallaxX, parallaxY }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef({ x: parallaxX, y: parallaxY });

  useEffect(() => {
    parallaxRef.current = { x: parallaxX, y: parallaxY };
  }, [parallaxX, parallaxY]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Benchmark resolution: 1774 x 887 (2:1 aspect ratio)
    const width = 1774;
    const height = 887;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // 2. Orthographic Camera: 1 world unit = 1 pixel at all depths
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      -2000,
      2000
    );
    camera.position.set(0, 0, 1000);
    camera.lookAt(0, 0, 0);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.LinearToneMapping;
    container.appendChild(renderer.domElement);

    // 4. Postprocessing: Restrained Bloom
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.14, // smooth stable bloom strength
      0.25, // gentle halo radius
      0.65  // smooth threshold without jumpy flicker
    );
    composer.addPass(bloomPass);

    // 5. Globe World Coordinates:
    // Benchmark Center (874.0, 454.0) -> World (-13.0, -10.5)
    // Radius: 325.0px (calibrated to reference image silhouette)
    const globeWorldX = 874.0 - 887.0;    // -13.0
    const globeWorldY = 443.5 - 454.0;    // -10.5
    const globeRadius = 325.0;

    const globeGroup = new THREE.Group();
    globeGroup.position.set(globeWorldX, globeWorldY, 0);
    // Initial 3D tilt matching curved latitude arcs in reference
    globeGroup.rotation.x = 0.38;
    globeGroup.rotation.z = -0.26;
    scene.add(globeGroup);

    const noise3D = createNoise3D();

    // ==========================================
    // 6. SPHERE OCCLUDER (Physical 3D Depth Occlusion)
    // ==========================================
    // Radius 313: guarantees front orbits are cleanly in front without z-fighting,
    // while back orbits are naturally occluded by the sphere core.
    const occluderGeo = new THREE.SphereGeometry(globeRadius - 12.0, 64, 64);
    const occluderMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthWrite: true,
      colorWrite: true,
    });
    const occluder = new THREE.Mesh(occluderGeo, occluderMat);
    occluder.renderOrder = 1;
    globeGroup.add(occluder);

    // ==========================================
    // 7. SPHERE SURFACE PARTICLES (Anti-flicker optimized density)
    // ==========================================
    const surfaceCount = 32000;
    const surfacePositions = new Float32Array(surfaceCount * 3);
    const surfaceSizes = new Float32Array(surfaceCount);
    const surfaceAlphas = new Float32Array(surfaceCount);
    const surfaceNoises = new Float32Array(surfaceCount);

    const numBands = 220;
    let pIdx = 0;

    for (let b = 0; b < numBands; b++) {
      const phiBase = ((b + (Math.random() - 0.5) * 0.7) / numBands) * Math.PI;
      const sinPhi = Math.sin(phiBase);
      const bandFraction = sinPhi / (numBands * (2.0 / Math.PI));
      const pointsInThisBand = Math.max(8, Math.round(surfaceCount * bandFraction * 0.98));

      for (let i = 0; i < pointsInThisBand && pIdx < surfaceCount; i++) {
        const thetaBase = (i / pointsInThisBand) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;

        let nx = Math.sin(phiBase) * Math.cos(thetaBase);
        let ny = Math.cos(phiBase);
        let nz = Math.sin(phiBase) * Math.sin(thetaBase);

        // 3D Simplex noise for organic density variations and flow
        const nFlow = noise3D(nx * 1.8, ny * 1.8, nz * 1.8);
        const phi = phiBase + nFlow * 0.04;
        const theta = thetaBase + phi * 0.42 + nFlow * 0.07;

        nx = Math.sin(phi) * Math.cos(theta);
        ny = Math.cos(phi);
        nz = Math.sin(phi) * Math.sin(theta);

        const n1 = noise3D(nx * 2.8, ny * 2.8, nz * 2.8);
        const n2 = noise3D(nx * 5.6, ny * 5.6, nz * 5.6) * 0.5;
        const combinedNoise = (n1 + n2) * 0.5;

        const r = globeRadius + (Math.random() - 0.5) * 2.5;

        surfacePositions[pIdx * 3] = nx * r;
        surfacePositions[pIdx * 3 + 1] = ny * r;
        surfacePositions[pIdx * 3 + 2] = nz * r;

        // Smooth consistent particle size without jarring glitter flashing
        surfaceSizes[pIdx] = 1.0 + Math.random() * 0.85;
        let alpha = 0.4 + 0.55 * Math.max(0, combinedNoise + 0.3);

        surfaceAlphas[pIdx] = alpha;
        surfaceNoises[pIdx] = combinedNoise;

        pIdx++;
      }
    }

    // Fill remaining points smoothly
    while (pIdx < surfaceCount) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      const r = globeRadius + (Math.random() - 0.5) * 2.5;

      surfacePositions[pIdx * 3] = nx * r;
      surfacePositions[pIdx * 3 + 1] = ny * r;
      surfacePositions[pIdx * 3 + 2] = nz * r;
      surfaceSizes[pIdx] = 0.8 + Math.random() * 0.9;
      surfaceAlphas[pIdx] = 0.45;
      surfaceNoises[pIdx] = 0.0;
      pIdx++;
    }

    const surfaceGeo = new THREE.BufferGeometry();
    surfaceGeo.setAttribute('position', new THREE.BufferAttribute(surfacePositions, 3));
    surfaceGeo.setAttribute('aSize', new THREE.BufferAttribute(surfaceSizes, 1));
    surfaceGeo.setAttribute('aAlpha', new THREE.BufferAttribute(surfaceAlphas, 1));
    surfaceGeo.setAttribute('aNoise', new THREE.BufferAttribute(surfaceNoises, 1));

    const surfaceMat = new THREE.ShaderMaterial({
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uLightDir: { value: new THREE.Vector3(0.7, 0.7, 1.0) },
        uGlobeCenter: { value: new THREE.Vector2(globeWorldX, globeWorldY) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const surfacePoints = new THREE.Points(surfaceGeo, surfaceMat);
    surfacePoints.renderOrder = 3;
    globeGroup.add(surfacePoints);

    // ==========================================
    // 7c. IRREGULAR CONSTELLATION CLUSTERS (Sparse & Organic Asterisms)
    // ==========================================
    // A small number of discrete, organic constellations scattered across the sphere,
    // completely avoiding any uniform grid or blocky tiling.
    interface AsterismStar {
      x: number;
      y: number;
      z: number;
      size: number;
      alpha: number;
    }

    const allStars: AsterismStar[] = [];
    const lineIndices: number[] = [];

    // Distinct spherical regions (phi, theta) to scatter the clusters irregularly
    const clusterSeeds = [
      { phi: 1.05, theta: 0.65 },  // Front upper-right
      { phi: 1.65, theta: 2.25 },  // Front mid-left
      { phi: 2.10, theta: 0.95 },  // Front lower-center
      { phi: 1.25, theta: 3.80 },  // Back mid-left
      { phi: 0.75, theta: 5.15 },  // Back upper-right
      { phi: 2.05, theta: 4.45 },  // Back lower
      { phi: 1.55, theta: 5.85 },  // Equatorial far-right
    ];

    clusterSeeds.forEach((seed, cIdx) => {
      const cPhi = seed.phi + (Math.random() - 0.5) * 0.18;
      const cTheta = seed.theta + (Math.random() - 0.5) * 0.25;

      const center = new THREE.Vector3(
        globeRadius * Math.sin(cPhi) * Math.cos(cTheta),
        globeRadius * Math.cos(cPhi),
        globeRadius * Math.sin(cPhi) * Math.sin(cTheta)
      );

      // Local tangent frame
      const normal = center.clone().normalize();
      const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const tangentU = new THREE.Vector3().crossVectors(normal, up).normalize();
      const tangentV = new THREE.Vector3().crossVectors(normal, tangentU).normalize();

      // Small number of stars: 3 to 5 stars per cluster
      const numStars = 3 + (cIdx % 3);
      const clusterIndices: number[] = [];

      // Local 2D coordinates on tangent plane (irregular organic layouts)
      let offsets: { u: number; v: number }[] = [];
      if (numStars === 3) {
        // Delicate 3-star chain or slight curve (like Orion's Belt or Triangulum)
        const d = 34 + Math.random() * 16;
        offsets = [
          { u: -d * 0.7, v: (Math.random() - 0.5) * 12 },
          { u: (Math.random() - 0.5) * 8, v: (Math.random() - 0.5) * 10 },
          { u: d * 0.7, v: (Math.random() - 0.5) * 14 },
        ];
      } else if (numStars === 4) {
        // Asymmetric open triangle with antenna tail
        const d = 36 + Math.random() * 16;
        offsets = [
          { u: -d * 0.6, v: -d * 0.35 },
          { u: d * 0.15, v: -d * 0.45 },
          { u: d * 0.55, v: d * 0.2 },
          { u: -d * 0.2, v: d * 0.5 },
        ];
      } else {
        // 5-star zigzag / open W (like Cassiopeia)
        const d = 44 + Math.random() * 18;
        offsets = [
          { u: -d * 0.75, v: d * 0.3 },
          { u: -d * 0.35, v: -d * 0.35 },
          { u: 0.05, v: d * 0.2 },
          { u: d * 0.4, v: -d * 0.25 },
          { u: d * 0.8, v: d * 0.35 },
        ];
      }

      offsets.forEach((off, sIdx) => {
        const starPos = center.clone()
          .addScaledVector(tangentU, off.u)
          .addScaledVector(tangentV, off.v)
          .normalize()
          .multiplyScalar(globeRadius + (Math.random() - 0.5) * 1.5);

        const gIdx = allStars.length;
        clusterIndices.push(gIdx);

        // First star in each constellation is a prominent beacon star
        const isBeacon = sIdx === 0;
        allStars.push({
          x: starPos.x,
          y: starPos.y,
          z: starPos.z,
          size: isBeacon ? (2.6 + Math.random() * 1.2) : (1.3 + Math.random() * 0.7),
          alpha: isBeacon ? 0.9 : (0.45 + Math.random() * 0.25),
        });
      });

      // Internal irregular connections ONLY (NO connections across clusters)
      if (numStars === 3) {
        lineIndices.push(clusterIndices[0], clusterIndices[1]);
        lineIndices.push(clusterIndices[1], clusterIndices[2]);
      } else if (numStars === 4) {
        // Triangle with antenna tail: 0-1, 1-2, 2-0, 2-3
        lineIndices.push(clusterIndices[0], clusterIndices[1]);
        lineIndices.push(clusterIndices[1], clusterIndices[2]);
        lineIndices.push(clusterIndices[2], clusterIndices[0]);
        lineIndices.push(clusterIndices[2], clusterIndices[3]);
      } else if (numStars === 5) {
        // Zigzag chain: 0-1, 1-2, 2-3, 3-4
        lineIndices.push(clusterIndices[0], clusterIndices[1]);
        lineIndices.push(clusterIndices[1], clusterIndices[2]);
        lineIndices.push(clusterIndices[2], clusterIndices[3]);
        lineIndices.push(clusterIndices[3], clusterIndices[4]);
      }
    });

    // Add 24 isolated natural lone stars across the sphere to enrich the cosmic depth without lines
    const loneStarCount = 24;
    for (let k = 0; k < loneStarCount; k++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = globeRadius + (Math.random() - 0.5) * 1.5;
      allStars.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.sin(theta),
        size: 1.2 + Math.random() * 1.1,
        alpha: 0.35 + Math.random() * 0.3,
      });
    }

    // Build Constellation Line Segments
    const linePosArray = new Float32Array(lineIndices.length * 3);
    for (let k = 0; k < lineIndices.length; k++) {
      const s = allStars[lineIndices[k]];
      linePosArray[k * 3] = s.x;
      linePosArray[k * 3 + 1] = s.y;
      linePosArray[k * 3 + 2] = s.z;
    }

    const constLineGeo = new THREE.BufferGeometry();
    constLineGeo.setAttribute('position', new THREE.BufferAttribute(linePosArray, 3));

    // Custom shader for constellation lines with directional illumination and depth awareness
    const constLineMat = new THREE.ShaderMaterial({
      vertexShader: `
        uniform vec3 uLightDir;
        uniform vec2 uGlobeCenter;
        varying float vAlpha;
        varying float vLuminance;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;

          vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
          vec3 lightDir = normalize(uLightDir);
          
          float NdotL = max(0.0, dot(normal, lightDir));
          float front = smoothstep(-0.15, 0.35, normal.z);
          
          // Grazing rim highlight on upper-right
          float fresnel = 1.0 - abs(normal.z);
          vec2 lightDir2D = normalize(lightDir.xy);
          float upperRight = max(0.0, dot(normal.xy, lightDir2D));
          float rim = pow(fresnel, 2.0) * pow(upperRight, 1.4);

          // Soft suppression behind headline text for maximum legibility
          vec2 textOffset = (worldPos.xy - uGlobeCenter) - vec2(51.0, 9.0);
          float textDist = length(textOffset);
          float textSuppression = 1.0 - 0.92 * (1.0 - smoothstep(110.0, 210.0, textDist)) * smoothstep(-0.1, 0.4, normal.z);

          float alpha = (0.18 + 0.52 * NdotL + 0.55 * rim) * front * textSuppression;
          vAlpha = clamp(alpha, 0.0, 0.85);
          vLuminance = min(1.0, 0.75 + 0.35 * (NdotL + rim));
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vLuminance;

        void main() {
          gl_FragColor = vec4(vec3(vLuminance), vAlpha * 0.42);
        }
      `,
      uniforms: {
        uLightDir: { value: new THREE.Vector3(0.7, 0.7, 1.0) },
        uGlobeCenter: { value: new THREE.Vector2(globeWorldX, globeWorldY) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    const constLineMesh = new THREE.LineSegments(constLineGeo, constLineMat);
    constLineMesh.renderOrder = 4;
    globeGroup.add(constLineMesh);

    // Build Constellation Star Points
    const starCount = allStars.length;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starAlphas = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = allStars[i].x;
      starPositions[i * 3 + 1] = allStars[i].y;
      starPositions[i * 3 + 2] = allStars[i].z;
      starSizes[i] = allStars[i].size;
      starAlphas[i] = allStars[i].alpha;
    }

    const constStarGeo = new THREE.BufferGeometry();
    constStarGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    constStarGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    constStarGeo.setAttribute('aAlpha', new THREE.BufferAttribute(starAlphas, 1));

    const constStarMat = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uPixelRatio;
        uniform vec3 uLightDir;
        uniform vec2 uGlobeCenter;
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        varying float vLuminance;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;

          vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
          vec3 lightDir = normalize(uLightDir);
          
          float NdotL = max(0.0, dot(normal, lightDir));
          float front = smoothstep(-0.2, 0.35, normal.z);

          float fresnel = 1.0 - abs(normal.z);
          vec2 lightDir2D = normalize(lightDir.xy);
          float upperRight = max(0.0, dot(normal.xy, lightDir2D));
          float rim = pow(fresnel, 2.0) * pow(upperRight, 1.4);

          vec2 textOffset = (worldPos.xy - uGlobeCenter) - vec2(51.0, 9.0);
          float textDist = length(textOffset);
          float textSuppression = 1.0 - 0.92 * (1.0 - smoothstep(110.0, 210.0, textDist)) * smoothstep(-0.1, 0.4, normal.z);

          float alpha = aAlpha * (0.35 + 0.65 * NdotL + 0.7 * rim) * front * textSuppression;
          vAlpha = clamp(alpha, 0.0, 0.95);
          vLuminance = min(1.0, 0.88 + 0.3 * (NdotL + rim));

          float pointSize = aSize * uPixelRatio * (1.0 + 0.35 * rim);
          gl_PointSize = max(2.0, pointSize);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vLuminance;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          // Glowing round star profile with bright core
          float edgeAlpha = smoothstep(0.5, 0.08, dist);
          float core = smoothstep(0.2, 0.0, dist) * 0.4;
          
          gl_FragColor = vec4(vec3(min(1.0, vLuminance + core)), edgeAlpha * vAlpha);
        }
      `,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uLightDir: { value: new THREE.Vector3(0.7, 0.7, 1.0) },
        uGlobeCenter: { value: new THREE.Vector2(globeWorldX, globeWorldY) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    const constStarMesh = new THREE.Points(constStarGeo, constStarMat);
    constStarMesh.renderOrder = 5;
    globeGroup.add(constStarMesh);

    // ==========================================
    // 7b. SPHERE RIM PARTICLES (10% fewer)
    // ==========================================
    // Concentrated exclusively on the upper-right brilliant crescent
    const rimCount = 4200;
    const rimPositions = new Float32Array(rimCount * 3);
    const rimSizes = new Float32Array(rimCount);
    const rimAlphas = new Float32Array(rimCount);

    for (let i = 0; i < rimCount; i++) {
      // Angle along the crescent arc: upper-right (-25 deg to +75 deg relative to +X)
      // Light direction in 2D is (0.7, 0.7) -> 45 deg
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 1.5;
      // Z spread: grazing near the limb (z close to 0)
      const zFrac = (Math.random() - 0.5) * 0.7;
      const z = globeRadius * zFrac;
      const rAtZ = Math.sqrt(Math.max(0, globeRadius * globeRadius - z * z));
      
      const r = rAtZ + (Math.random() - 0.5) * 1.6;
      
      rimPositions[i * 3] = r * Math.cos(angle);
      rimPositions[i * 3 + 1] = r * Math.sin(angle);
      rimPositions[i * 3 + 2] = z;

      rimSizes[i] = 0.8 + Math.random() * 1.4;
      rimAlphas[i] = 0.6 + Math.random() * 0.4;
    }

    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.BufferAttribute(rimPositions, 3));
    rimGeo.setAttribute('aSize', new THREE.BufferAttribute(rimSizes, 1));
    rimGeo.setAttribute('aAlpha', new THREE.BufferAttribute(rimAlphas, 1));

    const rimMat = new THREE.ShaderMaterial({
      vertexShader: rimVertexShader,
      fragmentShader: rimFragmentShader,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uLightDir: { value: new THREE.Vector3(0.7, 0.7, 1.0) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const rimPoints = new THREE.Points(rimGeo, rimMat);
    rimPoints.renderOrder = 4;
    globeGroup.add(rimPoints);

    // ==========================================
    // 8. SPHERE INNER PARTICLES
    // ==========================================
    const innerCount = 8800;
    const innerPositions = new Float32Array(innerCount * 3);
    const innerSizes = new Float32Array(innerCount);
    const innerAlphas = new Float32Array(innerCount);

    for (let i = 0; i < innerCount; i++) {
      const u = Math.random();
      const costheta = Math.random() * 2 - 1;
      const phi = Math.random() * 2 * Math.PI;
      const theta = Math.acos(costheta);
      const r = Math.cbrt(u) * (globeRadius - 10);

      innerPositions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      innerPositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      innerPositions[i * 3 + 2] = r * Math.cos(theta);

      innerSizes[i] = 0.6 + Math.random() * 0.8;
      innerAlphas[i] = 0.03 + Math.random() * 0.14;
    }

    const innerGeo = new THREE.BufferGeometry();
    innerGeo.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
    innerGeo.setAttribute('aSize', new THREE.BufferAttribute(innerSizes, 1));
    innerGeo.setAttribute('aAlpha', new THREE.BufferAttribute(innerAlphas, 1));

    const innerMat = new THREE.ShaderMaterial({
      vertexShader: innerVertexShader,
      fragmentShader: innerFragmentShader,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uGlobeCenter: { value: new THREE.Vector2(globeWorldX, globeWorldY) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const innerPoints = new THREE.Points(innerGeo, innerMat);
    innerPoints.renderOrder = 2;
    globeGroup.add(innerPoints);

    // ==========================================
    // 9. FOUR CALIBRATED 3D ORBITS
    // ==========================================
    const orbitsGroup = new THREE.Group();
    orbitsGroup.position.set(globeWorldX, globeWorldY, 0);
    scene.add(orbitsGroup);

    interface OrbitConfig {
      id: string;
      a: number;
      b: number;
      rotX: number;
      rotY: number;
      rotZ: number;
      fadePhase: number;
      opacity: number;
      linewidth: number;
    }

    // Horizontal, opposing diagonals, and a high polar sweep echo the reference.
    const orbitConfigs: OrbitConfig[] = [
      // 1. Wide horizontal ellipse (perceive <-> retain)
      {
        id: 'orbit-1',
        a: 664,
        b: 160,
        rotX: THREE.MathUtils.degToRad(-85.0),
        rotY: THREE.MathUtils.degToRad(5.5),
        rotZ: THREE.MathUtils.degToRad(-6.1),
        fadePhase: 0.4,
        opacity: 0.56,
        linewidth: 1.2,
      },
      // 2. Diagonal A (abandon <-> significant)
      {
        id: 'orbit-2',
        a: 648,
        b: 225,
        rotX: THREE.MathUtils.degToRad(-64),
        rotY: THREE.MathUtils.degToRad(-17.1),
        rotZ: THREE.MathUtils.degToRad(34),
        fadePhase: 2.2,
        opacity: 0.48,
        linewidth: 1.1,
      },
      // 3. Diagonal B (context <-> fluent, passes star flare)
      {
        id: 'orbit-3',
        a: 646,
        b: 220,
        rotX: THREE.MathUtils.degToRad(-62),
        rotY: THREE.MathUtils.degToRad(23.5),
        rotZ: THREE.MathUtils.degToRad(-31),
        fadePhase: 4.0,
        opacity: 0.50,
        linewidth: 1.2,
      },
      // High arc above the lit rim, continuing toward the lower-left.
      {
        id: 'orbit-4',
        a: 455,
        b: 235,
        rotX: THREE.MathUtils.degToRad(38),
        rotY: THREE.MathUtils.degToRad(39),
        rotZ: THREE.MathUtils.degToRad(49),
        fadePhase: 5.2,
        opacity: 0.43,
        linewidth: 1.0,
      },
    ];

    orbitConfigs.forEach((cfg) => {
      const oGroup = new THREE.Group();
      oGroup.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);

      const segments = 256;
      const positions: number[] = [];
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        positions.push(cfg.a * Math.cos(theta), cfg.b * Math.sin(theta), 0);
      }

      const lineGeo = new LineGeometry();
      lineGeo.setPositions(positions);

      const lineMat = new LineMaterial({
        color: 0xffffff,
        linewidth: cfg.linewidth,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        // The silhouette mask below handles the soft edge without a hard depth cut.
        depthTest: false,
        depthWrite: false,
        resolution: new THREE.Vector2(width, height),
      });

      // LineMaterial is itself a ShaderMaterial. Change its source directly so
      // every orbit pixel uses the same screen-space spherical silhouette.
      lineMat.uniforms.uGlobeCenter = { value: new THREE.Vector2(globeWorldX, globeWorldY) };
      lineMat.uniforms.uGlobeRadius = { value: globeRadius };
      lineMat.uniforms.uArcFadePhase = { value: cfg.fadePhase };
      lineMat.vertexShader = lineMat.vertexShader
        .replace('uniform vec2 resolution;', 'uniform vec2 resolution;\n varying vec3 vOrbitWorldPosition;\n varying vec2 vOrbitLocalPosition;')
        .replace(
          'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
          `vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
           vec3 orbitPoint = position.y < 0.5 ? instanceStart : instanceEnd;
           vOrbitWorldPosition = (modelMatrix * vec4(orbitPoint, 1.0)).xyz;
           vOrbitLocalPosition = orbitPoint.xy;`
        );
      lineMat.fragmentShader = lineMat.fragmentShader
        .replace(
          'uniform float linewidth;',
          'uniform float linewidth;\n uniform vec2 uGlobeCenter;\n uniform float uGlobeRadius;\n uniform float uArcFadePhase;\n varying vec3 vOrbitWorldPosition;\n varying vec2 vOrbitLocalPosition;'
        )
        .replace(
          'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
          `float distanceFromCenter = length(vOrbitWorldPosition.xy - uGlobeCenter);
           // Physical 3D Occlusion: Front curve is clearly visible; back curve inside sphere disc is occluded
           float insideSphereDisc = 1.0 - smoothstep(uGlobeRadius - 6.0, uGlobeRadius, distanceFromCenter);
           float isBehind = 1.0 - smoothstep(-15.0, 15.0, vOrbitWorldPosition.z);
           float occlusion = 1.0 - (isBehind * insideSphereDisc);

           // Front curve is bright, crisp and passes in front of the sphere surface
           float isFront = smoothstep(-15.0, 35.0, vOrbitWorldPosition.z);
           float frontBrightness = mix(0.75, 1.45, isFront);

           float depthBrightness = mix(0.45, 1.0, smoothstep(-240.0, 240.0, vOrbitWorldPosition.z));
           float orbitAngle = atan(vOrbitLocalPosition.y, vOrbitLocalPosition.x);
           float flow = 0.5 + 0.5 * sin(orbitAngle + uArcFadePhase);
           float arcFade = mix(0.35, 1.0, smoothstep(0.12, 0.84, flow));

           gl_FragColor = vec4(diffuseColor.rgb, alpha * occlusion * depthBrightness * arcFade * frontBrightness);`
        );

      const line = new Line2(lineGeo, lineMat);
      line.computeLineDistances();
      line.renderOrder = 5;
      oGroup.add(line);

      orbitsGroup.add(oGroup);
    });

    // ==========================================
    // 10. ORBIT NODES & STAR FLARE
    // ==========================================
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    const makeNodeTexture = (hasFlare: boolean = false) => {
      const c = document.createElement('canvas');
      const size = hasFlare ? 256 : 64;
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d')!;
      const center = size / 2;

      if (hasFlare) {
        // Star flare: delicate needle spikes + tiny core
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center * 0.7);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.06, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.18)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(-25 * Math.PI / 180);

        // Needle-thin long spike along diagonal orbit (-25 deg)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(-116, 0);
        ctx.lineTo(116, 0);
        ctx.stroke();

        // Needle-thin perpendicular spike
        ctx.beginPath();
        ctx.moveTo(0, -96);
        ctx.lineTo(0, 96);
        ctx.stroke();

        // Subtle diagonal glints
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(-36, -36);
        ctx.lineTo(36, 36);
        ctx.moveTo(-36, 36);
        ctx.lineTo(36, -36);
        ctx.stroke();

        ctx.restore();
      } else {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center * 0.85);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center, center, center * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      return new THREE.CanvasTexture(c);
    };

    const dotTex = makeNodeTexture(false);
    const flareTex = makeNodeTexture(true);

    const staticNodesData = [
      { bx: 545.0, by: 174.0, z: 20, size: 8, flare: false },    // context node
      { bx: 327.0, by: 389.0, z: 20, size: 7.5, flare: false },  // perceive node
      { bx: 572.0, by: 656.0, z: 20, size: 8.5, flare: false },  // abandon node
      { bx: 1397.0, by: 240.0, z: 20, size: 8, flare: false },   // significant node
      { bx: 1403.0, by: 501.0, z: 20, size: 8.5, flare: false }, // retain node
      { bx: 1250.0, by: 701.0, z: 20, size: 8.5, flare: false }, // fluent node
      { bx: 1051.0, by: 477.0, z: 80, size: 46, flare: true },   // Center Star Flare
      { bx: 1148.6, by: 150.7, z: 20, size: 6, flare: false },   // Upper rim node
      { bx: 1282.0, by: 472.0, z: 20, size: 6, flare: false },   // Mid-right orbit node
    ];

    staticNodesData.forEach((nd) => {
      const mat = new THREE.SpriteMaterial({
        map: nd.flare ? flareTex : dotTex,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(nd.bx - 887, 443.5 - nd.by, nd.z);
      sprite.scale.set(nd.size, nd.size, 1);
      sprite.renderOrder = 10;
      nodesGroup.add(sprite);
    });

    // Moving nodes follow the remaining orbits.
    const movingNodes: {
      sprite: THREE.Sprite;
      orbitIdx: number;
      speed: number;
      progress: number;
    }[] = [];

    const movingConfigs = [
      { orbitIdx: 0, speed: 0.00035, initProgress: 0.22, size: 5 },
      { orbitIdx: 1, speed: 0.00028, initProgress: 0.55, size: 5 },
      { orbitIdx: 2, speed: 0.00032, initProgress: 0.88, size: 6 },
      { orbitIdx: 3, speed: 0.00025, initProgress: 0.38, size: 4.5 },
    ];

    movingConfigs.forEach((mc) => {
      const sMat = new THREE.SpriteMaterial({
        map: dotTex,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(sMat);
      sprite.scale.set(mc.size, mc.size, 1);
      sprite.renderOrder = 9;
      nodesGroup.add(sprite);
      movingNodes.push({
        sprite,
        orbitIdx: mc.orbitIdx,
        speed: mc.speed,
        progress: mc.initProgress,
      });
    });

    // ==========================================
    // 11. AMBIENT BACKGROUND DUST (240 particles)
    // ==========================================
    const dustCount = 240;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    const dustAlphas = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * width;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * height;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 600;

      dustSizes[i] = 0.5 + Math.random() * 1.3;
      dustAlphas[i] = 0.08 + Math.random() * 0.45;
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSizes, 1));
    dustGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dustAlphas, 1));

    const dustMat = new THREE.ShaderMaterial({
      vertexShader: dustVertexShader,
      fragmentShader: dustFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.renderOrder = 0;
    scene.add(dustPoints);

    // ==========================================
    // 12. ANIMATION LOOP & MOUSE PARALLAX
    // ==========================================
    let animationFrameId: number;
    let clock = new THREE.Clock();

    let curParallaxX = 0;
    let curParallaxY = 0;

    const baseRotX = 0.38;
    const baseRotZ = -0.26;

    const render = () => {
      const elapsed = clock.getElapsedTime();

      // Smooth stable rotation without high-frequency flashing or mouse wobbling
      globeGroup.rotation.y = elapsed * 0.018;
      globeGroup.rotation.x = baseRotX + elapsed * 0.002;
      globeGroup.rotation.z = baseRotZ;

      orbitsGroup.rotation.y = 0;
      orbitsGroup.rotation.x = 0;

      surfaceMat.uniforms.uTime.value = elapsed;
      dustMat.uniforms.uTime.value = elapsed;

      // Update moving orbit nodes along ellipses
      movingNodes.forEach((mn) => {
        mn.progress = (mn.progress + mn.speed) % 1.0;
        const cfg = orbitConfigs[mn.orbitIdx];
        const theta = mn.progress * Math.PI * 2;

        const localPt = new THREE.Vector3(cfg.a * Math.cos(theta), cfg.b * Math.sin(theta), 0);
        const euler = new THREE.Euler(cfg.rotX, cfg.rotY, cfg.rotZ, 'XYZ');
        localPt.applyEuler(euler);

        mn.sprite.position.set(
          globeWorldX + localPt.x,
          globeWorldY + localPt.y,
          localPt.z
        );
        const radialDistance = Math.hypot(localPt.x, localPt.y);
        const isBehind = 1.0 - THREE.MathUtils.smoothstep(localPt.z, -15, 15);
        const insideSphereDisc = 1.0 - THREE.MathUtils.smoothstep(radialDistance, globeRadius - 6, globeRadius);
        const occlusion = 1.0 - (isBehind * insideSphereDisc);
        const isFront = THREE.MathUtils.smoothstep(localPt.z, -15, 35);
        const frontBoost = THREE.MathUtils.lerp(0.75, 1.35, isFront);

        const depthBrightness = THREE.MathUtils.lerp(
          0.45,
          1,
          THREE.MathUtils.smoothstep(localPt.z, -240, 240)
        );
        const orbitAngle = Math.atan2(cfg.b * Math.sin(theta), cfg.a * Math.cos(theta));
        const flow = 0.5 + 0.5 * Math.sin(orbitAngle + cfg.fadePhase);
        const arcFade = THREE.MathUtils.lerp(0.35, 1, THREE.MathUtils.smoothstep(flow, 0.12, 0.84));
        (mn.sprite.material as THREE.SpriteMaterial).opacity =
          depthBrightness * arcFade * occlusion * frontBoost;
      });

      composer.render();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
};
