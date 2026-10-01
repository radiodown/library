// 테트리스 게임 규칙. 화면과 상관없는 순수 함수만 두고, 상태는 늘 새 객체로 돌려줍니다.

export const COLS = 10
export const ROWS = 20

// 블록 모양. 1이 칸이 차 있는 자리입니다. 회전은 이 정사각 행렬을 돌려서 만듭니다.
const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

export const PIECE_TYPES = Object.keys(SHAPES)

// 한 번에 지운 줄 수별 기본 점수. 현재 레벨을 곱합니다.
const LINE_SCORES = [0, 100, 300, 500, 800]

export function shapeOf(type) {
  return SHAPES[type]
}

function rotateMatrix(m, dir) {
  const n = m.length
  return m.map((row, y) => row.map((_, x) => (dir > 0 ? m[n - 1 - x][y] : m[x][n - 1 - y])))
}

/** 7종류를 한 번씩 섞어 꺼내는 주머니. 같은 블록이 너무 오래 안 나오는 일이 없습니다. */
function newBag() {
  const bag = [...PIECE_TYPES]
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

function takeFromBag(bag) {
  const rest = bag.length ? bag : newBag()
  return { type: rest[0], bag: rest.slice(1) }
}

function spawn(type) {
  const matrix = SHAPES[type]
  return { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: type === 'I' ? -1 : 0 }
}

/** 블록이 벽/바닥/쌓인 칸과 겹치는지. 화면 위(y < 0)로 삐져나온 칸은 허용합니다. */
export function collides(board, piece) {
  return piece.matrix.some((row, dy) =>
    row.some((cell, dx) => {
      if (!cell) return false
      const x = piece.x + dx
      const y = piece.y + dy
      if (x < 0 || x >= COLS || y >= ROWS) return true
      return y >= 0 && board[y][x] !== null
    }),
  )
}

export function levelSpeed(level) {
  return Math.max(80, 800 - (level - 1) * 70)
}

export function createGame() {
  const first = takeFromBag(newBag())
  const second = takeFromBag(first.bag)
  return {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    piece: spawn(first.type),
    next: second.type,
    bag: second.bag,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    tetrisRoll: null, // 네 줄을 한 번에 지울 때마다 새로 뽑는 0~1 난수 (보여 줄 인용구 고르기용)
  }
}

/** 블록을 바닥에 고정하고, 찬 줄을 지우고, 다음 블록을 꺼냅니다. */
function lockPiece(state, bonus = 0) {
  const { piece } = state
  const board = state.board.map((row) => [...row])
  let toppedOut = false
  piece.matrix.forEach((row, dy) =>
    row.forEach((cell, dx) => {
      if (!cell) return
      const y = piece.y + dy
      if (y < 0) toppedOut = true
      else board[y][piece.x + dx] = piece.type
    }),
  )

  const kept = board.filter((row) => row.some((c) => c === null))
  const cleared = ROWS - kept.length
  const newBoard = [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...kept]

  const lines = state.lines + cleared
  const level = Math.floor(lines / 10) + 1
  const score = state.score + bonus + LINE_SCORES[cleared] * state.level

  const drawn = takeFromBag(state.bag)
  const nextPiece = spawn(state.next)
  const over = toppedOut || collides(newBoard, nextPiece)

  return {
    ...state,
    board: newBoard,
    piece: nextPiece,
    next: drawn.type,
    bag: drawn.bag,
    score,
    lines,
    level,
    over,
    tetrisRoll: cleared === 4 ? Math.random() : state.tetrisRoll,
  }
}

export function move(state, dx) {
  const piece = { ...state.piece, x: state.piece.x + dx }
  return collides(state.board, piece) ? state : { ...state, piece }
}

/** 회전. 벽이나 블록에 막히면 옆이나 위로 조금 밀어서(벽 차기) 들어갈 자리를 찾습니다. */
export function rotate(state, dir = 1) {
  if (state.piece.type === 'O') return state
  const matrix = rotateMatrix(state.piece.matrix, dir)
  const kicks = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
  ]
  for (const [kx, ky] of kicks) {
    const piece = { ...state.piece, matrix, x: state.piece.x + kx, y: state.piece.y + ky }
    if (!collides(state.board, piece)) return { ...state, piece }
  }
  return state
}

/** 한 칸 내리기. 더 못 내려가면 고정합니다. soft가 참이면 직접 내린 것이라 1점을 줍니다. */
export function stepDown(state, soft = false) {
  const piece = { ...state.piece, y: state.piece.y + 1 }
  if (collides(state.board, piece)) return lockPiece(state)
  return { ...state, piece, score: state.score + (soft ? 1 : 0) }
}

/** 바닥까지 바로 떨어뜨리기. 떨어진 칸마다 2점입니다. */
export function hardDrop(state) {
  const ghost = ghostPiece(state)
  const distance = ghost.y - state.piece.y
  return lockPiece({ ...state, piece: ghost }, distance * 2)
}

/** 지금 블록이 그대로 떨어지면 닿을 자리 (미리보기 그림자) */
export function ghostPiece(state) {
  let piece = state.piece
  while (!collides(state.board, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 }
  return piece
}
