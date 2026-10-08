import { useEffect, useRef, useState } from 'react'
import LiquidGlass from '@nkzw/liquid-glass'
import { useTheme } from '../hooks/useTheme'
import { useMediaQuery } from '../hooks/useMediaQuery'

const STILL_POINTER = { x: 0, y: 0 }

/** Decorative glass only: controls and editor content never move between wrappers. */
export default function GlassBackdrop({ radius = 22 }) {
  const theme = useTheme()
  const reducedEffects = useMediaQuery('(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)')
  const hostRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const enabled = theme === 'liquid' && !reducedEffects

  useEffect(() => {
    if (!enabled || !hostRef.current) return
    const host = hostRef.current
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [enabled])

  if (theme !== 'liquid') return null

  return (
    <div className="glass-backdrop" ref={hostRef} aria-hidden="true" inert>
      {enabled && size.width > 0 && size.height > 0 && (
        <LiquidGlass
          key={`${size.width}:${size.height}`}
          className="glass-backdrop__effect"
          style={{ position: 'absolute', left: '50%', top: '50%' }}
          borderRadius={radius}
          padding="0"
          blurAmount={0.35}
          displacementScale={40}
          aberrationIntensity={1.2}
          saturation={145}
          elasticity={0}
          globalMousePos={STILL_POINTER}
          mouseOffset={STILL_POINTER}
        >
          <span style={{ display: 'block', width: size.width, height: size.height }} />
        </LiquidGlass>
      )}
    </div>
  )
}
