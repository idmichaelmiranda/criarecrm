import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const TARGET = new THREE.Vector3(0, 0, 0)

export function HeroCamera() {
  const { camera } = useThree()

  // Stable base position — avoid jump on first frame
  const baseX = useRef(0)
  const baseY = useRef(0)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Sub-1% micro drift — imperceptible individually, creates life
    const dx = Math.sin(t * 0.07)  * 0.022 + Math.sin(t * 0.13) * 0.008
    const dy = Math.cos(t * 0.055) * 0.016 + Math.cos(t * 0.09) * 0.006

    camera.position.x = dx
    camera.position.y = dy
    camera.lookAt(TARGET)
  })

  return null
}
