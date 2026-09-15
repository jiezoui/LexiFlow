"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { SparklesIcon } from "lucide-react"

export interface ParticleWordSphereProps {
  className?: string
  showControls?: boolean
  autoRotateSpeed?: number
  interactive?: boolean
  heroWord?: string
  initialDensity?: number
}

interface VocabItem {
  w: string
  tier: "hero" | "huge" | "large" | "mid" | "micro"
}

const VOCAB_DATABASE: VocabItem[] = [
  // Front Prominent Words (matching reference image)
  { w: "flow", tier: "huge" },
  { w: "create", tier: "huge" },
  { w: "design", tier: "huge" },
  { w: "system", tier: "huge" },
  { w: "productivity", tier: "large" },
  { w: "workspace", tier: "large" },
  { w: "data", tier: "large" },
  { w: "build", tier: "large" },
  { w: "digital", tier: "large" },
  { w: "code", tier: "large" },
  { w: "technology", tier: "large" },
  { w: "innovation", tier: "large" },
  { w: "future", tier: "large" },
  { w: "workflow", tier: "large" },
  { w: "redesign", tier: "large" },
  { w: "ereclign", tier: "large" },
  { w: "cognition", tier: "large" },
  { w: "shadowing", tier: "large" },
  { w: "retrieval", tier: "large" },
  { w: "resonance", tier: "large" },
  { w: "collaborate", tier: "large" },
  { w: "collabpratent", tier: "large" },
  { w: "fsrs", tier: "large" },

  // Secondary Varied Depth Words
  { w: "ephemeral", tier: "mid" },
  { w: "serendipity", tier: "mid" },
  { w: "neuroplasticity", tier: "mid" },
  { w: "eloquent", tier: "mid" },
  { w: "prosody", tier: "mid" },
  { w: "cadence", tier: "mid" },
  { w: "nuance", tier: "mid" },
  { w: "ubiquitous", tier: "mid" },
  { w: "equilibrium", tier: "mid" },
  { w: "catalyst", tier: "mid" },
  { w: "lucid", tier: "mid" },
  { w: "zenith", tier: "mid" },
  { w: "paradigm", tier: "mid" },
  { w: "synergy", tier: "mid" },
  { w: "aesthetic", tier: "mid" },
  { w: "trajectory", tier: "mid" },
  { w: "luminary", tier: "mid" },
  { w: "velocity", tier: "mid" },
  { w: "lexicon", tier: "mid" },
  { w: "acoustic", tier: "mid" },
  { w: "immersion", tier: "mid" },
  { w: "matrix", tier: "mid" },
  { w: "mnemonic", tier: "mid" },
  { w: "fluency", tier: "mid" },
  { w: "polyglot", tier: "mid" },
  { w: "vernacular", tier: "mid" },
  { w: "articulate", tier: "mid" },
  { w: "comprehend", tier: "mid" },
  { w: "retention", tier: "mid" },
  { w: "context", tier: "mid" },
  { w: "perception", tier: "mid" },
  { w: "whisper", tier: "mid" },
  { w: "waveform", tier: "mid" },
  { w: "stability", tier: "mid" },
  { w: "difficulty", tier: "mid" },
  { w: "half-life", tier: "mid" },
  { w: "decide", tier: "mid" },
  { w: "deante", tier: "mid" },
  { w: "digiten", tier: "mid" },
  { w: "desteen", tier: "mid" },
  { w: "duture", tier: "mid" },
  { w: "deilletaxation", tier: "mid" },
  { w: "aderkflen", tier: "mid" },
  { w: "delaboran", tier: "mid" },

  // Small & Micro Fillers
  { w: "code", tier: "micro" },
  { w: "date", tier: "micro" },
  { w: "web", tier: "micro" },
  { w: "net", tier: "micro" },
  { w: "synapse", tier: "micro" },
  { w: "interval", tier: "micro" },
  { w: "decay", tier: "micro" },
  { w: "pitch", tier: "micro" },
  { w: "timbre", tier: "micro" },
  { w: "weeb", tier: "micro" },
  { w: "lexi-", tier: "micro" },
  { w: "-flow", tier: "micro" },
  { w: "/æ/", tier: "micro" },
  { w: "/ə/", tier: "micro" },
  { w: "/θ/", tier: "micro" },
  { w: "/ð/", tier: "micro" },
  { w: "/ŋ/", tier: "micro" },
  { w: "/ʃ/", tier: "micro" },
  { w: "λ", tier: "micro" },
  { w: "Ω", tier: "micro" },
  { w: "∫", tier: "micro" },
]

class SphereWordNode {
  data: VocabItem
  text: string
  isFixedHero: boolean
  phi: number
  theta: number
  radialRatio: number
  baseSize: number
  weight: string
  tilt: number

  x = 0
  y = 0
  z = 0
  screenX = 0
  screenY = 0
  scale = 1
  cosAngle = 1
  squashX = 1
  contourAngle = 0

  constructor(data: VocabItem, phi: number, theta: number, radialRatio: number, isFixedHero = false, heroLabel = "LexiFlow") {
    this.data = data
    this.text = isFixedHero ? heroLabel : data.w
    this.isFixedHero = isFixedHero
    this.phi = phi
    this.theta = theta
    this.radialRatio = radialRatio

    // Irregular Size Disparity
    if (this.isFixedHero || data.tier === "hero") {
      this.baseSize = 50
      this.weight = "900"
      this.tilt = 0
    } else if (data.tier === "huge") {
      this.baseSize = 28 + Math.floor(Math.random() * 14)
      this.weight = "900"
      this.tilt = (Math.random() - 0.5) * 0.38
    } else if (data.tier === "large") {
      this.baseSize = 17 + Math.floor(Math.random() * 10)
      this.weight = "800"
      this.tilt = (Math.random() - 0.5) * 0.32
    } else if (data.tier === "mid") {
      this.baseSize = 11 + Math.floor(Math.random() * 7)
      this.weight = Math.random() < 0.6 ? "700" : "600"
      this.tilt = (Math.random() - 0.5) * 0.25
    } else {
      this.baseSize = 8 + Math.floor(Math.random() * 4)
      this.weight = "500"
      this.tilt = (Math.random() - 0.5) * 0.18
    }
  }

  update(rotX: number, rotY: number, nominalRadius: number, fov: number, cameraZ: number, cx: number, cy: number) {
    const r = nominalRadius * this.radialRatio

    const x0 = r * Math.cos(this.theta) * Math.sin(this.phi)
    const y0 = r * Math.sin(this.theta) * Math.sin(this.phi)
    const z0 = r * Math.cos(this.phi)

    const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
    const x1 = x0 * cosY - z0 * sinY
    const z1 = x0 * sinY + z0 * cosY

    const cosX = Math.cos(rotX), sinX = Math.sin(rotX)
    const y2 = y0 * cosX - z1 * sinX
    const z2 = y0 * sinX + z1 * cosX

    this.x = x1
    this.y = y2
    this.z = z2

    const zDist = z2 + cameraZ
    this.scale = fov / (fov + zDist)
    this.screenX = cx + x1 * this.scale
    this.screenY = cy + y2 * this.scale

    const cosView = z2 / r
    this.cosAngle = cosView

    this.squashX = Math.max(0.24, Math.min(1.0, 0.30 + 0.70 * Math.abs(cosView)))

    const distNorm = Math.min(1.0, Math.hypot(x1, y2) / nominalRadius)
    if (distNorm > 0.35 && !this.isFixedHero) {
      const radialAngle = Math.atan2(y2, x1)
      this.contourAngle = Math.sin(radialAngle * 2) * 0.28 * Math.pow(distNorm, 1.8)
    } else {
      this.contourAngle = 0
    }
  }
}

class FloatingDust {
  x0 = 0
  y0 = 0
  z0 = 0
  size = 2
  isSquare = false
  rot = 0
  rotSpeed = 0
  alpha = 0.5

  constructor(baseRadius: number) {
    this.reset(baseRadius)
  }

  reset(baseRadius: number) {
    const r = baseRadius * (1.08 + Math.random() * 0.45)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)

    this.x0 = r * Math.sin(phi) * Math.cos(theta)
    this.y0 = r * Math.sin(phi) * Math.sin(theta)
    this.z0 = r * Math.cos(phi)

    const roll = Math.random()
    if (roll < 0.15) {
      this.size = 7 + Math.random() * 3
      this.isSquare = true
    } else if (roll < 0.45) {
      this.size = 3.5 + Math.random() * 2.5
      this.isSquare = true
    } else {
      this.size = 1.4 + Math.random() * 1.6
      this.isSquare = Math.random() < 0.3
    }

    this.rot = Math.random() * Math.PI * 2
    this.rotSpeed = (Math.random() - 0.5) * 0.02
    this.alpha = 0.45 + Math.random() * 0.50
  }

  render(ctx: CanvasRenderingContext2D, rotX: number, rotY: number, fov: number, cameraZ: number, cx: number, cy: number) {
    const cosY = Math.cos(rotY * 0.7), sinY = Math.sin(rotY * 0.7)
    const x1 = this.x0 * cosY - this.z0 * sinY
    const z1 = this.x0 * sinY + this.z0 * cosY

    const cosX = Math.cos(rotX * 0.7), sinX = Math.sin(rotX * 0.7)
    const y2 = this.y0 * cosX - z1 * sinX
    const z2 = this.y0 * sinX + z1 * cosX

    const zDist = z2 + cameraZ
    if (zDist < 20) return

    const scale = fov / (fov + zDist)
    const sx = cx + x1 * scale
    const sy = cy + y2 * scale

    this.rot += this.rotSpeed

    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(this.rot)

    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`
    if (this.size > 4 && z2 > 0) {
      ctx.shadowColor = "#ffffff"
      ctx.shadowBlur = 8
    }

    if (this.isSquare) {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size)
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

export function ParticleWordSphere({
  className = "",
  showControls = false,
  autoRotateSpeed = 0.0028,
  heroWord = "LexiFlow",
  initialDensity = 900,
}: ParticleWordSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const [activeHero, setActiveHero] = useState<string>(heroWord)
  const [ringVisible, setRingVisible] = useState<boolean>(true)
  const [dustVisible, setDustVisible] = useState<boolean>(true)
  const [density, setDensity] = useState<number>(initialDensity)
  const [radiusScale, setRadiusScale] = useState<number>(1.0)
  const [speed, setSpeed] = useState<number>(autoRotateSpeed)

  const ringPhotonPhaseRef = useRef(0)
  const nodesRef = useRef<SphereWordNode[]>([])
  const dustRef = useRef<FloatingDust[]>([])

  const buildSphere = useCallback(() => {
    const nodes: SphereWordNode[] = []
    const TOTAL = density

    const pool: VocabItem[] = []
    while (pool.length < TOTAL + 100) {
      pool.push(...VOCAB_DATABASE)
    }

    // 1. Center Hero word
    const heroData: VocabItem = { w: activeHero, tier: "hero" }
    nodes.push(new SphereWordNode(heroData, Math.PI / 2, 0, 1.04, true, activeHero))

    // 2. Primary overlapping anchors
    const frontAnchors = [
      { w: "flow", tier: "huge" as const, phi: Math.PI / 2 - 0.28, theta: 0.32, rRatio: 1.08 },
      { w: "create", tier: "huge" as const, phi: Math.PI / 2 - 0.40, theta: -0.12, rRatio: 1.02 },
      { w: "design", tier: "huge" as const, phi: Math.PI / 2 - 0.10, theta: -0.52, rRatio: 1.06 },
      { w: "ereclign", tier: "large" as const, phi: Math.PI / 2 - 0.22, theta: -0.04, rRatio: 0.94 },
      { w: "system", tier: "huge" as const, phi: Math.PI / 2 + 0.26, theta: 0.08, rRatio: 1.02 },
      { w: "data", tier: "large" as const, phi: Math.PI / 2 + 0.16, theta: 0.50, rRatio: 1.04 },
      { w: "build", tier: "large" as const, phi: Math.PI / 2 + 0.36, theta: 0.60, rRatio: 1.00 },
      { w: "workspace", tier: "large" as const, phi: Math.PI / 2 + 0.50, theta: 0.16, rRatio: 0.98 },
      { w: "productivity", tier: "large" as const, phi: Math.PI / 2 + 0.34, theta: -0.46, rRatio: 0.96 },
      { w: "digital", tier: "large" as const, phi: Math.PI / 2 + 0.48, theta: -0.30, rRatio: 0.92 },
      { w: "technology", tier: "large" as const, phi: Math.PI / 2 + 0.76, theta: 0.04, rRatio: 1.02 },
      { w: "innovation", tier: "large" as const, phi: Math.PI / 2 + 0.70, theta: -0.28, rRatio: 0.98 },
      { w: "workflow", tier: "large" as const, phi: Math.PI / 2 - 0.08, theta: 0.82, rRatio: 1.02 },
      { w: "future", tier: "large" as const, phi: Math.PI / 2 + 0.66, theta: 0.56, rRatio: 1.04 },
      { w: "code", tier: "large" as const, phi: Math.PI / 2 - 0.62, theta: 0.42, rRatio: 0.95 },
    ]

    frontAnchors.forEach((anc) => {
      const matched = VOCAB_DATABASE.find(w => w.w.toLowerCase() === anc.w.toLowerCase()) || {
        w: anc.w,
        tier: anc.tier,
      }
      nodes.push(new SphereWordNode(matched, anc.phi, anc.theta, anc.rRatio, false, activeHero))
    })

    // 3. Dense Fibonacci distribution for all remaining words to solidly enclose the sphere
    const remainingCount = TOTAL - nodes.length
    for (let i = 0; i < remainingCount; i++) {
      const phi = Math.acos(-1 + (2 * (i + 1)) / (remainingCount + 1))
      const theta = Math.sqrt(remainingCount * Math.PI) * phi
      // Volumetric XYZ radial variation: 0.86 ~ 1.15
      const rSpread = 0.86 + ((i * 17) % 29) / 100 + Math.sin(i * 3.1) * 0.04
      nodes.push(new SphereWordNode(pool[i % pool.length], phi, theta, rSpread, false, activeHero))
    }

    nodesRef.current = nodes
    dustRef.current = Array.from({ length: 65 }, () => new FloatingDust(260))
  }, [activeHero, density])

  useEffect(() => {
    buildSphere()
  }, [buildSphere])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let width = 0
    let height = 0
    let cx = 0
    let cy = 0
    let dpr = 1
    let timeSec = 0
    let rotY = 0
    let rotX = 0.06

    const handleResize = () => {
      if (!canvas || !container) return
      dpr = window.devicePixelRatio || 1
      width = container.clientWidth
      height = container.clientHeight
      cx = width / 2
      cy = height / 2

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.resetTransform()
      ctx.scale(dpr, dpr)
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    const FOV = 520
    const CAMERA_Z = 560

    function drawOrbitRing(baseRadius: number, rX: number, rY: number, isFront: boolean) {
      if (!ctx) return
      const ringRadius = baseRadius * 1.30
      const SEGMENTS = 160
      const tiltZ = -22 * (Math.PI / 180)
      const cosTiltZ = Math.cos(tiltZ), sinTiltZ = Math.sin(tiltZ)
      const cosIncl = 0.32
      const sinIncl = 0.95

      const pts: { sx: number; sy: number; z3: number; t: number }[] = []
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = (i / SEGMENTS) * Math.PI * 2
        const u = ringRadius * Math.cos(t)
        const v = ringRadius * Math.sin(t)

        const rx0 = u
        const ry0 = v * cosIncl
        const rz0 = v * sinIncl

        const rx1 = rx0 * cosTiltZ - ry0 * sinTiltZ
        const ry1 = rx0 * sinTiltZ + ry0 * cosTiltZ
        const rz1 = rz0

        const cosY = Math.cos(rY * 0.8), sinY = Math.sin(rY * 0.8)
        const x2 = rx1 * cosY - rz1 * sinY
        const z2 = rx1 * sinY + rz1 * cosY

        const cosX = Math.cos(rX * 0.8), sinX = Math.sin(rX * 0.8)
        const y3 = ry1 * cosX - z2 * sinX
        const z3 = ry1 * sinX + z2 * cosX

        const zDist = z3 + CAMERA_Z
        const scale = FOV / (FOV + zDist)
        const sx = cx + x2 * scale
        const sy = cy + y3 * scale

        pts.push({ sx, sy, z3, t })
      }

      ctx.beginPath()
      let started = false

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const matches = isFront ? p.z3 >= 0 : p.z3 < 0

        if (matches) {
          if (!started) {
            ctx.moveTo(p.sx, p.sy)
            started = true
          } else {
            ctx.lineTo(p.sx, p.sy)
          }
        } else {
          started = false
        }
      }

      if (isFront) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"
        ctx.lineWidth = 1.6
        ctx.shadowColor = "#38bdf8"
        ctx.shadowBlur = 10
        ctx.stroke()

        ctx.strokeStyle = "rgba(56, 189, 248, 0.32)"
        ctx.lineWidth = 3.5
        ctx.shadowBlur = 0
        ctx.stroke()

        // Upper-right orbital flare ray
        const flareIdx = Math.floor(SEGMENTS * 0.26)
        const flarePt = pts[flareIdx]
        if (flarePt && flarePt.z3 >= -20) {
          ctx.save()
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(flarePt.sx, flarePt.sy)
          ctx.lineTo(flarePt.sx + 50, flarePt.sy - 26)
          ctx.stroke()

          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(flarePt.sx + 50, flarePt.sy - 26, 1.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        // Sparks
        const photonCount = 4
        for (let p = 0; p < photonCount; p++) {
          const phase = (ringPhotonPhaseRef.current + (p / photonCount) * Math.PI * 2) % (Math.PI * 2)
          const idx = Math.floor((phase / (Math.PI * 2)) * SEGMENTS)
          const pt = pts[idx]
          if (pt && pt.z3 >= 0) {
            ctx.save()
            ctx.fillStyle = "#ffffff"
            ctx.shadowColor = "#38bdf8"
            ctx.shadowBlur = 14
            ctx.beginPath()
            ctx.arc(pt.sx, pt.sy, 2.6, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
            ctx.fillRect(pt.sx - 6, pt.sy - 0.7, 12, 1.4)
            ctx.fillRect(pt.sx - 0.7, pt.sy - 6, 1.4, 12)
            ctx.restore()
          }
        }
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
        ctx.lineWidth = 0.9
        ctx.shadowBlur = 0
        ctx.stroke()
      }
    }

    const render = () => {
      timeSec += 0.016
      rotY += speed
      rotX = 0.06 + Math.sin(timeSec * 0.35) * 0.04

      ctx.clearRect(0, 0, width, height)

      // 🌟 EVEN LARGER SPHERE RADIUS
      const baseRadius = Math.min(width, height) * (width < 768 ? 0.50 : 0.47) * radiusScale

      // Ambient glow behind sphere
      const ambientGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, baseRadius * 1.35)
      ambientGlow.addColorStop(0, "rgba(18, 26, 46, 0.45)")
      ambientGlow.addColorStop(0.5, "rgba(8, 12, 22, 0.25)")
      ambientGlow.addColorStop(1, "transparent")
      ctx.fillStyle = ambientGlow
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius * 1.35, 0, Math.PI * 2)
      ctx.fill()

      // Update words
      const nodes = nodesRef.current
      for (const w of nodes) {
        w.update(rotX, rotY, baseRadius, FOV, CAMERA_Z, cx, cy)
      }

      // Sort words by Z depth (Back to Front)
      nodes.sort((a, b) => a.z - b.z)

      // 1. Orbital Ring Back Half
      ringPhotonPhaseRef.current += 0.018
      if (ringVisible) {
        drawOrbitRing(baseRadius, rotX, rotY, false)
      }

      // 2. Render Words (Solid Opacity, No Boundary Fade)
      for (const node of nodes) {
        const { screenX, screenY, scale, cosAngle, squashX, contourAngle, isFixedHero, data, tilt } = node

        const depthMultiplier = 0.74 + (cosAngle > 0 ? cosAngle * 0.60 : 0)
        const finalFontSize = Math.round(node.baseSize * scale * depthMultiplier)
        if (finalFontSize < 5) continue

        const isMonospace = data.tier === "micro"
        const fontFam = isMonospace ? "'DM Mono', monospace" : "'Inter', -apple-system, sans-serif"
        ctx.font = `${node.weight} ${finalFontSize}px ${fontFam}`

        ctx.save()
        ctx.translate(screenX, screenY)

        ctx.scale(squashX, 1.0)
        ctx.rotate(tilt + contourAngle)

        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        // 🌟 SOLID OPACITY, NO FADING AT BOUNDARY:
        if (cosAngle > 0.15) {
          if (isFixedHero || data.tier === "hero") {
            ctx.fillStyle = "#ffffff"
            ctx.shadowColor = "rgba(255, 255, 255, 0.9)"
            ctx.shadowBlur = Math.round(18 * cosAngle)
          } else if (data.tier === "huge") {
            ctx.fillStyle = "#ffffff"
            if (cosAngle > 0.5) {
              ctx.shadowColor = "rgba(255, 255, 255, 0.5)"
              ctx.shadowBlur = Math.round(12 * cosAngle)
            }
          } else if (data.tier === "large") {
            ctx.fillStyle = "#f1f5f9"
          } else if (data.tier === "mid") {
            ctx.fillStyle = "#cbd5e1"
          } else {
            ctx.fillStyle = "#7dd3fc"
          }
        } else if (cosAngle >= -0.15) {
          // Rim / Boundary: crisp light-slate, solid opacity 0.92, defining the sharp spherical silhouette
          ctx.fillStyle = "rgba(203, 213, 225, 0.92)"
        } else {
          // Back Hemisphere: solid deep slate 0.75, forming dense spherical interior
          ctx.fillStyle = "rgba(71, 85, 105, 0.75)"
        }

        ctx.fillText(node.text, 0, 0)
        ctx.restore()
      }

      // 3. Orbital Ring Front Half
      if (ringVisible) {
        drawOrbitRing(baseRadius, rotX, rotY, true)
      }

      // 4. Floating Dust
      if (dustVisible) {
        dustRef.current.forEach((d) => d.render(ctx, rotX, rotY, FOV, CAMERA_Z, cx, cy))
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", handleResize)
    }
  }, [ringVisible, dustVisible, speed, radiusScale])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#020306] select-none ${className}`}
    >
      {/* Cinematic Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(18,24,40,0.45)_0%,rgba(2,3,6,0.98)_72%)]" />

      {/* Main Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full z-10" />

      {/* Bottom Quote Caption (1:1 with reference picture) */}
      <div className="pointer-events-none absolute bottom-7 left-8 z-20 flex flex-col gap-2">
        <div className="h-0.5 w-7 rounded-full bg-white/45" />
        <div className="text-xs font-normal tracking-wide text-white/50">
          Flow into a more efficient acoustic language landscape
        </div>
      </div>

      {/* Optional Interactive Tuning Controls */}
      {showControls && (
        <div className="pointer-events-auto absolute top-6 right-6 z-20 flex w-60 flex-col gap-2.5 rounded-2xl border border-white/10 bg-zinc-900/80 p-3.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold uppercase tracking-wider text-[11px] text-zinc-300">视觉参数微调</span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">1:1 对标</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-400">核心居中词</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveHero("LexiFlow")}
                className={`rounded-lg px-2 py-1 text-center transition-all ${
                  activeHero === "LexiFlow" ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/50" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                LexiFlow
              </button>
              <button
                type="button"
                onClick={() => setActiveHero("Fexiflow")}
                className={`rounded-lg px-2 py-1 text-center transition-all ${
                  activeHero === "Fexiflow" ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/50" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Fexiflow (原图)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-400">轨道光环 / 空间微尘</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setRingVisible(!ringVisible)}
                className={`rounded-lg px-2 py-1 text-center transition-all ${
                  ringVisible ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/50" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                {ringVisible ? "光环已开启" : "光环已关闭"}
              </button>
              <button
                type="button"
                onClick={() => setDustVisible(!dustVisible)}
                className={`rounded-lg px-2 py-1 text-center transition-all ${
                  dustVisible ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/50" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                {dustVisible ? "微尘已开启" : "微尘已关闭"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>球体词汇密度</span>
              <span className="font-mono text-sky-400">{density} 词</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[600, 900, 1200].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setDensity(count)}
                  className={`rounded-md py-1 text-center text-[10px] transition-all ${
                    density === count ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/50" : "bg-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {count === 900 ? "极密(900)" : `${count}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>球体半径</span>
              <span className="font-mono text-sky-400">{radiusScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={radiusScale}
              onChange={(e) => setRadiusScale(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-sky-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}
