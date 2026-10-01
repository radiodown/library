// 소설 집필 프로그램의 도우미. 작품 자체는 서재 DB(novels 등 테이블)에 저장됩니다.

export const newId = () => crypto.randomUUID()

export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function createProject(title = '제목 없는 작품') {
  return {
    id: newId(),
    title,
    logline: '',
    createdAt: new Date().toISOString(),
    dailyGoal: 2000,
    // 날짜별 { start: 그날 처음 연 때의 전체 글자 수 } — 오늘 쓴 분량 = 지금 - start
    progress: {},
    chapters: [{ id: newId(), title: '1장', synopsis: '', text: '' }],
    characters: [],
    notes: [],
  }
}

// 마지막으로 연 작품은 서재마다 따로 기억합니다. (서재 파일에 넣을 정도의 정보는 아님)
const lastKey = (libraryId) => `library98:novel-last:${libraryId}`

export function readLastProjectId(libraryId) {
  try {
    return localStorage.getItem(lastKey(libraryId))
  } catch {
    return null
  }
}

export function writeLastProjectId(libraryId, id) {
  try {
    if (id) localStorage.setItem(lastKey(libraryId), id)
    else localStorage.removeItem(lastKey(libraryId))
  } catch {
    // 마지막 작품을 기억하지 못해도 작품 목록에서 다시 열 수 있습니다.
  }
}

// ---- 분량 ----

/** 공백 제외 글자 수 */
export const countChars = (text) => text.replace(/\s/g, '').length

export const totalChars = (project) => project.chapters.reduce((sum, c) => sum + countChars(c.text), 0)

/**
 * 200자 원고지 매수(대략). 문단마다 첫 칸을 들여 쓰고, 문단이 끝나면 남은 칸은 비우는 원고지 규칙을 따릅니다.
 */
export function manuscriptPages(text) {
  const COLS = 20
  let lines = 0
  for (const para of text.split('\n')) {
    const len = para.trim().length
    if (len === 0) continue
    lines += Math.ceil((len + 1) / COLS)
  }
  return lines / 10
}

// ---- 내보내기 / 백업 ----

export function manuscriptText(project) {
  const parts = project.chapters.map((c) => `${c.title}\n\n${c.text.trim()}`)
  return `${project.title}\n\n\n${parts.join('\n\n\n')}\n`
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const safeName = (title) => title.replace(/[\\/:*?"<>|]/g, '_').trim() || '작품'

export function exportManuscript(project) {
  downloadFile(`${safeName(project.title)}.txt`, manuscriptText(project), 'text/plain;charset=utf-8')
}

// ---- 막힐 때 ----

export const WRITING_PROMPTS = [
  '주인공이 절대 하지 않을 행동을 하게 만드세요. 왜 그랬을까요?',
  '이 장면을 다른 인물의 시점으로 한 문단만 다시 써 보세요.',
  '방 안에 있는 물건 하나가 사건의 단서가 됩니다.',
  '누군가 거짓말을 합니다. 독자만 그 사실을 압니다.',
  '날씨가 갑자기 바뀝니다. 인물들의 계획은 어떻게 될까요?',
  '주인공이 가장 아끼는 것을 잃게 하세요.',
  '대사 없이 표정과 몸짓만으로 갈등을 보여 주세요.',
  '오래전에 보낸 편지가 이제야 도착합니다.',
  '장면을 소리와 냄새로만 묘사해 보세요.',
  '조연이 주인공에게 숨겨 온 비밀을 털어놓습니다.',
  '시간을 1년 뒤로 건너뛰세요. 무엇이 달라졌나요?',
  '인물이 원하는 것과 필요한 것이 서로 부딪치게 하세요.',
  '이 장의 마지막 문장을 먼저 쓰고, 거기까지 거꾸로 걸어가 보세요.',
  '낯선 사람이 주인공의 이름을 알고 있습니다.',
  '가장 쉬운 해결책을 막아 버리세요. 인물은 어떤 길을 택할까요?',
  '같은 사건을 기억하는 두 인물의 기억이 서로 다릅니다.',
  '주인공이 처음으로 "아니요"라고 말합니다.',
  '평범한 일상 속에서 단 하나만 어긋나게 하세요.',
  '악역에게 공감할 만한 이유를 한 문단 써 보세요.',
  '지금 장면에서 가장 중요한 것을 일부러 말하지 않고 넘어가 보세요.',
]
