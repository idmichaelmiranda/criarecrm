import { useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

import { HeroLighting }        from './HeroLighting'
import { HeroCamera }          from './HeroCamera'
import { HeroParticles }       from './HeroParticles'
import { HeroPostProcessing }  from './HeroPostProcessing'
import { useCMaterial, useOrangeMaterial } from './HeroMaterials'

// ─── Geometry ─────────────────────────────────────────────────────────────────

// SVG viewBox 0–200, centered on the full logo (C + orange dot)
// CX=99.5 (midpoint of 14–185), CY=100, SCALE=0.013
const S = (x: number) => (x - 99.5) * 0.013
const T = (y: number) => -(y - 100) * 0.013

function buildCShape(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()

  shape.moveTo(S(155), T(22))
  shape.lineTo(S(48),  T(22))
  shape.quadraticCurveTo(S(14), T(22),  S(14), T(56))
  shape.lineTo(S(14),  T(144))
  shape.quadraticCurveTo(S(14), T(178), S(48), T(178))
  shape.lineTo(S(155), T(178))
  shape.lineTo(S(155), T(154))
  shape.lineTo(S(54),  T(154))
  shape.quadraticCurveTo(S(38), T(154), S(38), T(140))
  shape.lineTo(S(38),  T(60))
  shape.quadraticCurveTo(S(38), T(46),  S(54), T(46))
  shape.lineTo(S(155), T(46))
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth:            0.36,
    bevelEnabled:     true,
    bevelThickness:   0.018,
    bevelSize:        0.014,
    bevelSegments:    6,
    curveSegments:    10,
  })
  geo.computeVertexNormals()
  return geo
}

// ─── Scene content ────────────────────────────────────────────────────────────

function SceneContent() {
  const orangeRef  = useRef<THREE.Mesh>(null!)
  const cMat       = useCMaterial()
  const orangeMat  = useOrangeMaterial()

  const cGeo = useMemo(() => buildCShape(), [])
  useEffect(() => () => cGeo.dispose(), [cGeo])

  // C orange dot — energy breathing + micro scale pulse
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!orangeRef.current) return

    const mat = orangeRef.current.material as THREE.MeshPhysicalMaterial
    mat.emissiveIntensity = 0.48 + Math.sin(t * 0.52) * 0.09

    // Micro scale pulse — barely visible, creates warmth
    const p = 1 + Math.sin(t * 0.52) * 0.008
    orangeRef.current.scale.set(p, p, p)
  })

  // Orange square: center at (S(171), T(100)) = (0.9295, 0)
  // Left edge: 0.9295 − 0.182 = 0.7475 — 0.026 gap from C arm at 0.7215
  const OX = S(171)   // 0.9295
  const OW = 28 * 0.013  // 0.364
  const OH = 34 * 0.013  // 0.442

  return (
    <>
      <HeroCamera />
      <HeroLighting />

      {/* ── C shape ── */}
      {/*  ExtrudeGeometry goes z=0 → z=0.36; shift −0.18 to center on z=0 */}
      <mesh geometry={cGeo} position={[0, 0, -0.18]} castShadow={false}>
        <primitive object={cMat} attach="material" />
      </mesh>

      {/* ── Orange dot ── */}
      <mesh ref={orangeRef} position={[OX, 0, 0.01]} castShadow={false}>
        <boxGeometry args={[OW, OH, 0.38]} />
        <primitive object={orangeMat} attach="material" />
      </mesh>

      {/* ── Volumetric dust ── */}
      <HeroParticles />

      {/* ── Ground shadow — subtle depth cue ── */}
      <ContactShadows
        position={[0, -1.12, 0]}
        scale={3.5}
        blur={2.2}
        opacity={0.22}
        far={1.8}
        color="#1a2436"
      />

      {/* ── Post-processing ── */}
      <HeroPostProcessing />
    </>
  )
}

// ─── Canvas export ────────────────────────────────────────────────────────────

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#ffffff']} />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  )
}
