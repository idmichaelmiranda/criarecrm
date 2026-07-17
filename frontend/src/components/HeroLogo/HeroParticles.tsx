import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 90

export function HeroParticles() {
  const posRef = useRef<THREE.BufferAttribute>(null!)
  const matRef = useRef<THREE.PointsMaterial>(null!)

  // Random positions in a loose ellipsoid around the logo
  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 3.6
      arr[i * 3 + 1] = (Math.random() - 0.5) * 3.2
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.2
    }
    return arr
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const arr = posRef.current.array as Float32Array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Very slow upward drift with lateral micro oscillation
      arr[i * 3 + 1] += delta * 0.012
      arr[i * 3]     += Math.sin(t * 0.08 + i) * 0.0003

      // Recycle particles that drift too high
      if (arr[i * 3 + 1] > 1.6) arr[i * 3 + 1] = -1.6
    }
    posRef.current.needsUpdate = true

    // Opacity breathes very slowly
    if (matRef.current) {
      matRef.current.opacity = 0.16 + Math.sin(t * 0.2) * 0.04
    }
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          ref={posRef}
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.007}
        color="#c8d8f0"
        transparent
        opacity={0.16}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
