import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'

export function HeroLighting() {
  const keyRef = useRef<THREE.DirectionalLight>(null!)
  const rimRef = useRef<THREE.SpotLight>(null!)
  const fillRef = useRef<THREE.DirectionalLight>(null!)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Slow luminous breathing — barely perceptible
    keyRef.current.intensity  = 3.2 + Math.sin(t * 0.38) * 0.22
    rimRef.current.intensity  = 1.8 + Math.sin(t * 0.27 + 1.1) * 0.14
    fillRef.current.intensity = 0.55 + Math.sin(t * 0.21 + 2.3) * 0.08
  })

  return (
    <>
      {/* Ambient — almost imperceptible */}
      <ambientLight intensity={0.12} color="#a8b8d0" />

      {/* Key light — top-right, cinematic 3/4 */}
      <directionalLight
        ref={keyRef}
        position={[3.5, 4.5, 3]}
        intensity={3.2}
        color="#fff8f0"
        castShadow={false}
      />

      {/* Fill light — left, cool tint */}
      <directionalLight
        ref={fillRef}
        position={[-3, 2, 1.5]}
        intensity={0.55}
        color="#b0c8e8"
        castShadow={false}
      />

      {/* Rim light — back-top, edge highlight */}
      <spotLight
        ref={rimRef}
        position={[0.5, 3, -3.5]}
        intensity={1.8}
        angle={0.55}
        penumbra={0.85}
        color="#ffffff"
        castShadow={false}
      />

      {/* Bottom bounce — subtle warm fill from below */}
      <pointLight position={[0, -2, 2]} intensity={0.25} color="#f0dcc0" />

      {/* HDRI reflections — studio preset */}
      <Environment preset="studio" environmentIntensity={1.6} />
    </>
  )
}
