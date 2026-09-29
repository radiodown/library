import { useEffect } from 'react'

const BOOT_MS = 2200
const SHUTDOWN_MS = 1600

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 화면 아무 곳이나 누르거나 키를 누르면 onTrigger를 호출합니다. */
function useAnyInput(onTrigger) {
  useEffect(() => {
    window.addEventListener('pointerdown', onTrigger)
    window.addEventListener('keydown', onTrigger)
    return () => {
      window.removeEventListener('pointerdown', onTrigger)
      window.removeEventListener('keydown', onTrigger)
    }
  }, [onTrigger])
}

/** 시작 화면: 로고와 진행 막대. 누르거나 키를 누르면 건너뜁니다. */
function BootScreen({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, prefersReducedMotion() ? 600 : BOOT_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  useAnyInput(onDone)

  return (
    <div className="power power--boot" role="status" aria-label="서재를 시작하는 중">
      <div className="power__brand">
        <img
          className="power__logo"
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          alt=""
          draggable={false}
        />
        <div>
          <div className="power__name">
            Library<strong>98</strong>
          </div>
          <div className="power__sub">내 서재</div>
        </div>
      </div>
      <div className="power__progress" aria-hidden="true">
        <span />
      </div>
      <p className="power__hint">화면을 누르면 건너뜁니다</p>
    </div>
  )
}

/** 종료하는 중 화면. 잠시 뒤 onDone으로 넘어갑니다. */
function ShutdownScreen({ restart, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, prefersReducedMotion() ? 400 : SHUTDOWN_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="power power--shutdown" role="status">
      <p className="power__message">
        {restart ? '서재를 다시 시작하는 중입니다...' : '서재를 종료하는 중입니다...'}
      </p>
    </div>
  )
}

/** 꺼진 화면. 브라우저 탭은 스스로 닫을 수 없으므로, 누르거나 키를 누르면 다시 켭니다. */
function OffScreen({ onWake }) {
  useAnyInput(onWake)

  return (
    <div className="power power--off" role="status">
      <p className="power__off-message">이제 서재를 안전하게 닫을 수 있습니다.</p>
      <p className="power__off-hint">(화면을 누르거나 아무 키나 누르면 다시 켜집니다)</p>
    </div>
  )
}

/**
 * 부팅/종료 화면을 화면 전체에 덮어 씌웁니다.
 * state: 'booting' | 'shuttingDown' | 'off'  ('on'이면 아무것도 그리지 않음)
 */
export default function PowerScreen({ state, restart, onBooted, onShutdownDone, onWake }) {
  if (state === 'booting') return <BootScreen onDone={onBooted} />
  if (state === 'shuttingDown') return <ShutdownScreen restart={restart} onDone={onShutdownDone} />
  if (state === 'off') return <OffScreen onWake={onWake} />
  return null
}
