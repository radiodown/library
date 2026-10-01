import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  COLS,
  ROWS,
  createGame,
  ghostPiece,
  hardDrop,
  levelSpeed,
  move,
  rotate,
  shapeOf,
  stepDown,
} from '../utils/tetris'

const BEST_KEY = 'library98-tetris-best'

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function writeBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // 저장소를 못 쓰면 최고 점수가 이번 창에서만 유지될 뿐입니다.
  }
}

// phase: 'ready'(시작 전) → 'playing' ⇄ 'paused' → 'over'
function reducer(state, action) {
  const { phase, game } = state
  switch (action.type) {
    case 'start':
      return { phase: 'playing', game: createGame() }
    case 'pause':
      return phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resume':
      return phase === 'paused' ? { ...state, phase: 'playing' } : state
    default:
      break
  }
  if (phase !== 'playing') return state

  let next = game
  if (action.type === 'left') next = move(game, -1)
  else if (action.type === 'right') next = move(game, 1)
  else if (action.type === 'rotate') next = rotate(game, action.dir)
  else if (action.type === 'soft') next = stepDown(game, true)
  else if (action.type === 'tick') next = stepDown(game)
  else if (action.type === 'drop') next = hardDrop(game)
  if (next === game) return state
  return { phase: next.over ? 'over' : 'playing', game: next }
}

// e.key 대신 e.code: 한글 입력 상태에서도 같은 물리 키로 동작합니다.
const PLAY_KEYS = {
  ArrowLeft: { type: 'left' },
  ArrowRight: { type: 'right' },
  ArrowDown: { type: 'soft' },
  ArrowUp: { type: 'rotate', dir: 1 },
  KeyX: { type: 'rotate', dir: 1 },
  KeyZ: { type: 'rotate', dir: -1 },
  Space: { type: 'drop', once: true },
  KeyP: { type: 'pause', once: true },
  Escape: { type: 'pause', once: true },
}

function isTypingTarget(el) {
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  )
}

/** "다음 블록" 미리보기. 빈 줄과 빈 칸을 잘라내서 상자 가운데에 오게 합니다. */
function PiecePreview({ type }) {
  const matrix = shapeOf(type)
  const usedCols = matrix[0].map((_, x) => matrix.some((row) => row[x]))
  const trimmed = matrix
    .filter((row) => row.some(Boolean))
    .map((row) => row.filter((_, x) => usedCols[x]))
  return (
    <div
      className="tetris__preview-grid"
      style={{ gridTemplateColumns: `repeat(${trimmed[0].length}, 14px)` }}
    >
      {trimmed.flatMap((row, y) =>
        row.map((cell, x) => (
          <span
            key={`${y}-${x}`}
            className={cell ? `tetris__cell tetris__cell--${type}` : 'tetris__cell'}
          />
        )),
      )}
    </div>
  )
}

/**
 * 바탕화면의 "테트리스" 창. active는 이 창이 맨 앞 창인지이며,
 * 다른 창을 누르거나 최소화하면 자동으로 일시정지하고 키 입력도 받지 않습니다.
 * quotes/books: 네 줄을 한 번에 지우면 저장해 둔 인용구 하나를 보여 줍니다.
 */
export default function TetrisWindow({ active, quotes = [], books = [] }) {
  const [{ phase, game }, dispatch] = useReducer(reducer, null, () => ({
    phase: 'ready',
    game: createGame(),
  }))
  const [best, setBest] = useState(readBest)

  // 창이 뒤로 가거나 최소화되면 일시정지합니다. (렌더 중에 이전 값과 비교하는 React 권장 방식)
  const [wasActive, setWasActive] = useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (!active && phase === 'playing') dispatch({ type: 'pause' })
  }

  // 레벨이 오를수록 빨리 떨어집니다.
  useEffect(() => {
    if (phase !== 'playing') return undefined
    const id = setInterval(() => dispatch({ type: 'tick' }), levelSpeed(game.level))
    return () => clearInterval(id)
  }, [phase, game.level])

  useEffect(() => {
    if (!active) return undefined
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      if (phase === 'playing') {
        const action = PLAY_KEYS[e.code]
        if (!action) return
        e.preventDefault()
        if (action.once && e.repeat) return
        dispatch(action)
        return
      }
      const isGo = e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space'
      if (phase === 'paused' && (isGo || e.code === 'KeyP' || e.code === 'Escape')) {
        e.preventDefault()
        if (!e.repeat) dispatch({ type: 'resume' })
      } else if (
        (phase === 'ready' && isGo) ||
        // 게임 오버 직후엔 Space(바로 낙하)를 연타하던 중일 수 있어서 Enter로만 다시 시작합니다.
        (phase === 'over' && isGo && e.code !== 'Space')
      ) {
        e.preventDefault()
        if (!e.repeat) dispatch({ type: 'start' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, phase])

  // 게임이 끝나면 최고 점수를 갱신하고, 바뀐 최고 점수는 브라우저에 남깁니다.
  if (phase === 'over' && game.score > best) setBest(game.score)
  useEffect(() => {
    if (best > 0) writeBest(best)
  }, [best])

  const quotePool = useMemo(() => {
    const titles = new Map(books.map((b) => [b.id, b.title]))
    return quotes
      .filter((q) => q.content && titles.has(q.bookId))
      .map((q) => ({ content: q.content, title: titles.get(q.bookId) }))
  }, [quotes, books])

  // 네 줄을 한 번에 지울 때마다 인용구 하나를 새로 골라, 다음 네 줄 삭제까지 보여 줍니다.
  const quote =
    game.tetrisRoll !== null && quotePool.length > 0
      ? quotePool[Math.floor(game.tetrisRoll * quotePool.length)]
      : null

  // 쌓인 판 위에 떨어질 자리 그림자와 지금 블록을 겹쳐 그립니다.
  const cells = useMemo(() => {
    const view = game.board.map((row) => row.map((type) => (type ? { type } : null)))
    if (phase === 'ready') return view
    const paint = (piece, ghost) =>
      piece.matrix.forEach((row, dy) =>
        row.forEach((filled, dx) => {
          const y = piece.y + dy
          const x = piece.x + dx
          if (filled && y >= 0 && y < ROWS && x >= 0 && x < COLS) view[y][x] = { type: piece.type, ghost }
        }),
      )
    if (phase !== 'over') paint(ghostPiece(game), true)
    paint(game.piece, false)
    return view
  }, [game, phase])

  // 버튼에 포커스가 남으면 스페이스바/Enter가 버튼을 다시 누르므로 바로 놓아 줍니다.
  const press = (type) => (e) => {
    e.currentTarget.blur()
    dispatch({ type })
  }

  return (
    <div className="tetris">
      <div className="tetris__well" role="img" aria-label="테트리스 판">
        {cells.flatMap((row, y) =>
          row.map((cell, x) => (
            <span
              key={`${y}-${x}`}
              className={
                cell
                  ? `tetris__cell tetris__cell--${cell.type}${cell.ghost ? ' tetris__cell--ghost' : ''}`
                  : 'tetris__cell'
              }
            />
          )),
        )}

        {phase !== 'playing' && (
          <div className="tetris__overlay">
            {phase === 'ready' && (
              <p>
                <strong>TETRIS</strong>
                <br />
                Enter로 시작
              </p>
            )}
            {phase === 'paused' && (
              <p>
                <strong>일시정지</strong>
                <br />P 또는 Enter로 계속
              </p>
            )}
            {phase === 'over' && (
              <p>
                <strong>GAME OVER</strong>
                <br />
                {game.score > 0 && game.score >= best && (
                  <>
                    최고 점수!
                    <br />
                  </>
                )}
                Enter로 다시 시작
              </p>
            )}
          </div>
        )}
      </div>

      <div className="tetris__side">
        <fieldset className="tetris__box">
          <legend>다음</legend>
          <div className="tetris__preview">
            {phase !== 'ready' && <PiecePreview type={game.next} />}
          </div>
        </fieldset>

        <dl className="tetris__stats">
          <dt>점수</dt>
          <dd>{game.score.toLocaleString()}</dd>
          <dt>줄</dt>
          <dd>{game.lines}</dd>
          <dt>레벨</dt>
          <dd>{game.level}</dd>
          <dt>최고</dt>
          <dd>{best.toLocaleString()}</dd>
        </dl>

        {phase === 'playing' && (
          <button type="button" onClick={press('pause')}>
            일시정지
          </button>
        )}
        {phase === 'paused' && (
          <button type="button" onClick={press('resume')}>
            계속
          </button>
        )}
        {(phase === 'ready' || phase === 'over') && (
          <button type="button" onClick={press('start')}>
            {phase === 'over' ? '다시 시작' : '시작'}
          </button>
        )}

        {quote ? (
          <figure className="tetris__quote">
            <blockquote>{quote.content}</blockquote>
            <figcaption>— {quote.title}</figcaption>
          </figure>
        ) : (
          <ul className="tetris__keys">
            <li>← → 이동</li>
            <li>↑ / X 회전</li>
            <li>Z 반대 회전</li>
            <li>↓ 빨리 내리기</li>
            <li>Space 바로 낙하</li>
            <li>P 일시정지</li>
          </ul>
        )}
      </div>
    </div>
  )
}
