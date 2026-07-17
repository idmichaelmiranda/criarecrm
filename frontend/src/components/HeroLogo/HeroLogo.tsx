import { lazy, Suspense } from 'react'

const HeroScene = lazy(() => import('./HeroScene'))

// Static fallback shown during JS chunk load
function LogoFallback() {
  return (
    <img
      src="/logo3dhero.png"
      alt="Criare ERP"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        filter: 'drop-shadow(0 12px 32px rgba(30,45,78,0.22))',
      }}
    />
  )
}

interface HeroLogoProps {
  className?: string
  style?: React.CSSProperties
}

export default function HeroLogo({ className, style }: HeroLogoProps) {
  return (
    <div
      className={className}
      style={{
        width: 'min(240px, 62vw)',
        height: 'min(240px, 62vw)',
        margin: '0 auto',
        ...style,
      }}
    >
      <Suspense fallback={<LogoFallback />}>
        <HeroScene />
      </Suspense>
    </div>
  )
}
