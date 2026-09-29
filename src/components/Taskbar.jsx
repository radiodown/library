import { useEffect, useState } from 'react'

/** 하단 작업 표시줄. 열려 있는 창 목록과 시계를 보여줍니다. */
export default function Taskbar({ windows, onToggle }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="taskbar">
      <button type="button" className="taskbar__start">
        시작
      </button>

      <div className="taskbar__items">
        {windows.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`taskbar__item${!w.minimized ? ' is-active' : ''}`}
            onClick={() => onToggle(w.id)}
          >
            <span>{w.icon}</span> {w.title}
          </button>
        ))}
      </div>

      <div className="taskbar__clock">
        {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
