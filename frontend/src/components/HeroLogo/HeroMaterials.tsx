import { useMemo } from 'react'
import * as THREE from 'three'

// Brushed dark-metal aluminium for the C body
export function useCMaterial() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#1a2436'),
        metalness: 0.92,
        roughness: 0.24,
        envMapIntensity: 2.8,
        clearcoat: 0.08,
        clearcoatRoughness: 0.2,
        reflectivity: 1,
      }),
    [],
  )
}

// Glowing orange glass for the dot
export function useOrangeMaterial() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#F56316'),
        emissive: new THREE.Color('#FF6B00'),
        emissiveIntensity: 0.5,
        metalness: 0.05,
        roughness: 0.06,
        envMapIntensity: 1.4,
        clearcoat: 0.4,
        clearcoatRoughness: 0.1,
      }),
    [],
  )
}
