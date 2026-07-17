import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export function HeroPostProcessing() {
  return (
    <EffectComposer multisampling={4} disableNormalPass>
      {/* Cinematic tone mapping handled via Canvas gl prop */}

      {/* Subtle bloom — only on the brightest highlights and orange glow */}
      <Bloom
        luminanceThreshold={0.82}
        luminanceSmoothing={0.92}
        intensity={0.28}
        mipmapBlur
        radius={0.6}
      />

      {/* Very light vignette — draws the eye inward */}
      <Vignette
        darkness={0.28}
        offset={0.48}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
