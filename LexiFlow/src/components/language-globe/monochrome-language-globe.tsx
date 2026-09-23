"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import * as THREE from "three"
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import styles from "./monochrome-language-globe.module.css"

// Measured from the supplied 1774 × 887 reference, rather than the approximate brief.
const WIDTH = 1774
const HEIGHT = 887
const CENTER = new THREE.Vector3(883 - WIDTH / 2, HEIGHT / 2 - 454, 0)
const RADIUS = 313
const TAU = Math.PI * 2

const KEYWORDS = [
  { word: "context", x: 395, y: 142, duration: 9 },
  { word: "perceive", x: 270, y: 369, duration: 11 },
  { word: "abandon", x: 397, y: 608, duration: 8 },
  { word: "significant", x: 1307, y: 204, duration: 12 },
  { word: "retain", x: 1415, y: 447, duration: 10 },
  { word: "fluent", x: 1274, y: 682, duration: 7 },
]

export interface MonochromeLanguageGlobeProps {
  className?: string
  /** Disable motion for a deterministic reference frame. */
  animate?: boolean
  interactive?: boolean
}

function seededRandom(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

const pointVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  uniform float uTime;
  uniform float uLayer;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p += normalize(p) * sin(uTime * 0.22 + aAlpha * 37.0) * 0.32;
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(mat3(modelViewMatrix) * normalize(position));
    float fresnel = pow(1.0 - abs(n.z), 2.35);
    float directional = max(0.0, dot(n, normalize(vec3(0.7, 0.7, 1.0))));
    float edgeLight = pow(max(0.0, dot(normalize(n.xy), normalize(vec2(0.7, 0.9)))) * 0.5 + 0.5, 2.0);
    float light = 0.10 + fresnel * (0.35 + 1.45 * edgeLight) + directional * 0.20;
    if (uLayer < 0.5) light = 0.075 + fresnel * 0.13;
    if (uLayer > 1.5) light = fresnel * (0.16 + edgeLight * 1.6);
    float back = n.z < 0.0 ? 0.23 : 1.0;
    vAlpha = aAlpha * light * back;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(0.65, aSize * uScale);
  }
`
const pointFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float alpha = (1.0 - smoothstep(0.30, 1.0, d)) * vAlpha;
    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`

type ParticleLayer = "SphereInner" | "SphereSurface" | "SphereRim"

function createParticles(name: ParticleLayer, count: number, seed: number) {
  const random = seededRandom(seed)
  const noise = new ImprovedNoise()
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const alphas = new Float32Array(count)
  let i = 0
  while (i < count) {
    const z = random() * 2 - 1
    const angle = random() * TAU
    const xy = Math.sqrt(1 - z * z)
    const x = xy * Math.cos(angle)
    const y = xy * Math.sin(angle)
    const broad = noise.noise(x * 3.7 + 8, y * 3.7, z * 3.7)
    const fine = noise.noise(x * 17, y * 17 + 3, z * 17)
    const density = THREE.MathUtils.clamp(0.50 + broad * 0.85 + fine * 0.27, 0.07, 0.96)
    if (random() > density) continue
    const radius = name === "SphereInner"
      ? RADIUS * Math.cbrt(random()) * 0.99
      : RADIUS * (0.994 + random() * 0.012 + fine * 0.003)
    positions.set([x * radius, y * radius, z * radius], i * 3)
    sizes[i] = 0.7 + Math.pow(random(), 1.5) * 1.1
    alphas[i] = (0.25 + random() * 0.75) * (0.65 + density * 0.55)
    i++
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uTime: { value: 0 }, uLayer: { value: name === "SphereInner" ? 0 : name === "SphereSurface" ? 1 : 2 } },
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geometry, material)
  points.name = name
  points.renderOrder = name === "SphereInner" ? 3 : name === "SphereSurface" ? 4 : 5
  return points
}

function createDust() {
  const random = seededRandom(1807)
  const positions: number[] = []
  const sizes: number[] = []
  const alphas: number[] = []
  for (let i = 0; i < 240; i++) {
    positions.push((random() - 0.5) * WIDTH, (random() - 0.5) * HEIGHT, -900)
    sizes.push(0.5 + random() * 1.3)
    alphas.push(0.08 + Math.pow(random(), 3) * 0.47)
  }
  // Fine, local shed particles belong to the globe's atmosphere, not a star field.
  for (let i = 0; i < 5500; i++) {
    const angle = random() * TAU
    const r = RADIUS * (1.01 + Math.pow(random(), 2.4) * 0.66)
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    positions.push(CENTER.x + x * 1.20, CENTER.y + y * 0.96, -850)
    sizes.push(0.5 + random() * 0.9)
    alphas.push((0.025 + Math.pow(random(), 5) * 0.23) * (1 - (r / RADIUS - 1)))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vAlpha;
      void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(0.65, aSize * uScale); }`,
    fragmentShader: pointFragment,
    transparent: true, depthWrite: false, depthTest: false,
  })
  const points = new THREE.Points(geometry, material)
  points.name = "AmbientDust"
  points.renderOrder = 1
  return points
}

// Each ellipse is a real plane in world space. Its projected major/minor axes
// are calibrated to the reference. The plane's depth is retained for occlusion.
const ORBITS = [
  { x: 763, y: 381, a: 660, b: 122, rx: 1.20, ry: 0.05, rz: -0.167, opacity: 0.65, width: 0.9, period: 39 },
  { x: 1029, y: 506, a: 714, b: 119, rx: -1.12, ry: -0.08, rz: 0.205, opacity: 0.70, width: 1.05, period: 45 },
  { x: 882, y: 416, a: 674, b: 139, rx: 1.24, ry: 0.06, rz: -0.484, opacity: 0.58, width: 0.85, period: 42 },
  { x: 912, y: 386, a: 622, b: 154, rx: -1.05, ry: 0.03, rz: 0.366, opacity: 0.46, width: 0.75, period: 34 },
  { x: 1037, y: 438, a: 457, b: 155, rx: 1.02, ry: -0.10, rz: -0.855, opacity: 0.18, width: 0.65, period: 28 },
]
type OrbitSpec = (typeof ORBITS)[number]

function orbitPoint(spec: OrbitSpec, angle: number, target: THREE.Vector3) {
  target.set(Math.cos(angle) * spec.a, Math.sin(angle) * spec.b / Math.cos(spec.rx), 0)
  target.applyEuler(new THREE.Euler(spec.rx, spec.ry, spec.rz, "YXZ"))
  target.x += spec.x - WIDTH / 2
  target.y += HEIGHT / 2 - spec.y
  return target
}

const orbitVertex = /* glsl */ `
  attribute float aSide;
  attribute vec3 aNext;
  attribute float aPhase;
  uniform float uWidth;
  varying vec3 vWorld;
  varying float vPhase;
  varying float vSide;
  void main() {
    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    vec2 tangent = normalize(aNext.xy - position.xy);
    world.xy += vec2(-tangent.y, tangent.x) * aSide * uWidth;
    vWorld = world;
    vPhase = aPhase;
    vSide = aSide;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`
const orbitFragment = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uFront;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPeriod;
  varying vec3 vWorld;
  varying float vPhase;
  varying float vSide;
  void main() {
    bool front = vWorld.z >= 0.0;
    if ((uFront > 0.5) != front) discard;
    vec2 d = vWorld.xy - uCenter.xy;
    float r2 = dot(d, d);
    if (r2 < uRadius * uRadius && vWorld.z < sqrt(uRadius * uRadius - r2)) discard;
    float edge = 1.0 - smoothstep(0.30, 1.0, abs(vSide));
    float travel = 0.86 + 0.14 * sin(vPhase - uTime * 6.2831853 / uPeriod);
    float fade = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(vPhase + 0.4), 0.6);
    gl_FragColor = vec4(vec3(1.0), edge * uOpacity * fade * travel);
  }
`

function createOrbit(spec: OrbitSpec, front: boolean) {
  const positions: number[] = [], next: number[] = [], sides: number[] = [], phases: number[] = [], indices: number[] = []
  const p = new THREE.Vector3(), q = new THREE.Vector3()
  const segments = 1024
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * TAU
    orbitPoint(spec, angle, p)
    orbitPoint(spec, angle + 0.001, q)
    for (const side of [-1, 1]) {
      positions.push(p.x, p.y, p.z)
      next.push(q.x, q.y, q.z)
      sides.push(side)
      phases.push(angle)
    }
    if (i < segments) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2) }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("aNext", new THREE.Float32BufferAttribute(next, 3))
  geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(sides, 1))
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1))
  geometry.setIndex(indices)
  const material = new THREE.ShaderMaterial({
    vertexShader: orbitVertex, fragmentShader: orbitFragment,
    uniforms: {
      uCenter: { value: CENTER }, uRadius: { value: RADIUS }, uFront: { value: front ? 1 : 0 },
      uOpacity: { value: spec.opacity }, uWidth: { value: spec.width }, uTime: { value: 0 }, uPeriod: { value: spec.period },
    },
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = front ? "FrontOrbit" : "BackOrbit"
  mesh.renderOrder = front ? 6 : 2
  return mesh
}

const NODE_ANCHORS = [
  { orbit: 2, x: 543, y: 176, size: 4.3, moving: false },
  { orbit: 0, x: 308, y: 423, size: 4.0, moving: false },
  { orbit: 1, x: 575, y: 658, size: 4.5, moving: false },
  { orbit: 3, x: 1442, y: 261, size: 4.6, moving: false },
  { orbit: 0, x: 1402, y: 503, size: 4.5, moving: false },
  { orbit: 2, x: 1252, y: 703, size: 4.7, moving: false },
  { orbit: 1, x: 331, y: 559, size: 4.0, moving: false },
  { orbit: 3, x: 1149, y: 150, size: 2.8, moving: true },
  { orbit: 0, x: 1284, y: 476, size: 2.6, moving: true },
  { orbit: 4, x: 668, y: 454, size: 2.2, moving: true },
]

function createNodes() {
  const phases = NODE_ANCHORS.map(node => {
    const p = new THREE.Vector3()
    let best = 0, distance = Infinity
    for (let i = 0; i < 4096; i++) {
      orbitPoint(ORBITS[node.orbit], i / 4096 * TAU, p)
      const d = (p.x + WIDTH / 2 - node.x) ** 2 + (HEIGHT / 2 - p.y - node.y) ** 2
      if (d < distance) { distance = d; best = i / 4096 * TAU }
    }
    return best
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODE_ANCHORS.length * 3), 3))
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(NODE_ANCHORS.map(n => n.size), 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uCenter: { value: CENTER }, uRadius: { value: RADIUS } },
    vertexShader: `attribute float aSize; uniform float uScale; varying vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * 6.0 * uScale; }`,
    fragmentShader: `uniform vec3 uCenter; uniform float uRadius; varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xy - uCenter.xy; float r2 = dot(p,p);
        if (r2 < uRadius*uRadius && vWorld.z < sqrt(uRadius*uRadius-r2)) discard;
        float d = length(gl_PointCoord - 0.5) * 6.0;
        float core = 1.0 - smoothstep(0.36, 0.58, d);
        float halo = exp(-d*d*1.7) * 0.22;
        gl_FragColor = vec4(vec3(1.0), core + halo);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geometry, material)
  points.name = "OrbitNodes"
  points.renderOrder = 7
  const p = new THREE.Vector3()
  function update(time: number) {
    const attribute = geometry.getAttribute("position")
    NODE_ANCHORS.forEach((node, i) => {
      const spec = ORBITS[node.orbit]
      orbitPoint(spec, phases[i] + (node.moving ? time * TAU / spec.period : 0), p)
      attribute.setXYZ(i, p.x, p.y, p.z)
    })
    attribute.needsUpdate = true
  }
  update(0)
  return { points, update }
}

export function MonochromeLanguageGlobe({ className = "", animate = true, interactive = true }: MonochromeLanguageGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const host = hostRef.current, stage = stageRef.current, canvas = canvasRef.current
    if (!host || !stage || !canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" })
    } catch {
      setUnavailable(true)
      return
    }
    renderer.setClearColor(0x000000, 1)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 4000)
    camera.position.z = 2000
    const globe = new THREE.Group()
    globe.position.copy(CENTER)
    const layers = [createParticles("SphereInner", 20000, 71), createParticles("SphereSurface", 54000, 172), createParticles("SphereRim", 14000, 903)]
    layers.forEach(layer => globe.add(layer))
    scene.add(globe)
    const dust = createDust()
    scene.add(dust)
    const orbits = ORBITS.flatMap(spec => [createOrbit(spec, false), createOrbit(spec, true)])
    orbits.forEach(orbit => scene.add(orbit))
    const nodes = createNodes()
    scene.add(nodes.points)
    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    const bloom = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.15, 0.35, 0.72)
    composer.addPass(renderPass)
    composer.addPass(bloom)
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    // Optional capture switch freezes both WebGL and HTML at the reference frame.
    const still = !animate || new URLSearchParams(window.location.search).get("still") === "1"
    let reducedMotion = motionQuery.matches
    let visible = true
    let frame = 0, lastTime = 0, elapsed = 0
    let scale = 1
    const pointer = new THREE.Vector2(), smoothedPointer = new THREE.Vector2()
    const motionEnabled = () => !still && !reducedMotion
    const render = () => composer.render()
    function resize() {
      if (!host || !stage) return
      scale = Math.min(host.clientWidth / WIDTH, host.clientHeight / HEIGHT)
      stage.style.transform = `translate(-50%, -50%) scale(${scale})`
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      renderer.setPixelRatio(dpr)
      renderer.setSize(Math.max(1, WIDTH * scale), Math.max(1, HEIGHT * scale), false)
      composer.setPixelRatio(dpr)
      composer.setSize(Math.max(1, WIDTH * scale), Math.max(1, HEIGHT * scale))
      ;[...layers, dust, nodes.points].forEach(object => { object.material.uniforms.uScale.value = scale * dpr })
      render()
    }
    function tick(now: number) {
      frame = 0
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0
      lastTime = now
      if (motionEnabled()) {
        elapsed += delta
        smoothedPointer.lerp(pointer, 1 - Math.exp(-delta * 3))
        globe.rotation.y = elapsed * 0.09 + smoothedPointer.x * Math.PI / 90
        globe.rotation.x = elapsed * 0.012 + smoothedPointer.y * Math.PI / 90
        layers.forEach(layer => { layer.material.uniforms.uTime.value = elapsed })
        orbits.forEach(orbit => { orbit.material.uniforms.uTime.value = elapsed })
        nodes.update(elapsed)
        if (stage) {
          stage.style.setProperty("--parallax-x", `${smoothedPointer.x * 6}px`)
          stage.style.setProperty("--parallax-y", `${smoothedPointer.y * 6}px`)
        }
      }
      render()
      if (visible && !document.hidden && motionEnabled()) frame = requestAnimationFrame(tick)
    }
    function resume() {
      stage?.setAttribute("data-motion", String(motionEnabled() && visible && !document.hidden))
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      if (visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    function onMotionChange() { reducedMotion = motionQuery.matches; resume() }
    function onPointerMove(event: PointerEvent) {
      if (!interactive || !motionEnabled() || !host) return
      const bounds = host.getBoundingClientRect()
      pointer.set(THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1), THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1))
    }
    function onPointerLeave() { pointer.set(0, 0) }
    function onContextLost(event: Event) { event.preventDefault(); cancelAnimationFrame(frame); setUnavailable(true) }
    function onContextRestored() { setUnavailable(false); resize(); resume() }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume() })
    intersection.observe(host)
    host.addEventListener("pointermove", onPointerMove)
    host.addEventListener("pointerleave", onPointerLeave)
    canvas.addEventListener("webglcontextlost", onContextLost)
    canvas.addEventListener("webglcontextrestored", onContextRestored)
    document.addEventListener("visibilitychange", resume)
    motionQuery.addEventListener("change", onMotionChange)
    resize()
    resume()
    host.dataset.ready = "true"
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      intersection.disconnect()
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerleave", onPointerLeave)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      canvas.removeEventListener("webglcontextrestored", onContextRestored)
      document.removeEventListener("visibilitychange", resume)
      motionQuery.removeEventListener("change", onMotionChange)
      scene.traverse(object => {
        if (object instanceof THREE.Points || object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => material.dispose())
        }
      })
      bloom.dispose()
      renderPass.dispose()
      composer.dispose()
      renderer.dispose()
      delete host.dataset.ready
    }
  }, [animate, interactive])

  return (
    <div ref={hostRef} className={`${styles.globe} ${className}`} role="img" aria-label="Words Create A Wider You. A monochrome particle globe encircled by context, perceive, abandon, significant, retain and fluent.">
      <div ref={stageRef} className={styles.stage} data-motion="false">
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.keywords} aria-hidden="true">
          {KEYWORDS.map(({ word, x, y, duration }, index) => (
            <span key={word} className={styles.keyword} style={{ left: x, top: y, "--duration": `${duration}s`, "--direction": index % 2 ? -1 : 1 } as CSSProperties}>{word}</span>
          ))}
        </div>
        <div className={styles.typography} aria-hidden="true">Words<br />Create<br />A Wider You.</div>
        <svg className={styles.grain} width={WIDTH} height={HEIGHT} aria-hidden="true">
          <filter id="language-globe-grain"><feTurbulence type="fractalNoise" baseFrequency="0.84" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#language-globe-grain)" opacity="0.022" />
        </svg>
      </div>
      {unavailable && <p className={styles.fallback}>Enable WebGL to view the particle globe.</p>}
    </div>
  )
}
