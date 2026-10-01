import { useEffect, useRef, useState } from 'react'
import MenuBar from './MenuBar'
import PixelIcon from './PixelIcon'
import { useDialog } from './dialogContext'
import {
  WRITING_PROMPTS,
  countChars,
  createProject,
  exportManuscript,
  manuscriptPages,
  newId,
  readLastProjectId,
  todayKey,
  totalChars,
  writeLastProjectId,
} from '../utils/novelStore'

const FONT_KEY = 'library98:novel-font'
const TABS = [
  { key: 'chapters', label: '원고' },
  { key: 'characters', label: '인물' },
  { key: 'notes', label: '자료' },
]
const CHARACTER_TEMPLATE = '나이/직업:\n외모:\n성격:\n원하는 것:\n두려워하는 것:\n비밀:\n'

function readFontSize() {
  try {
    return Number(localStorage.getItem(FONT_KEY)) || 16
  } catch {
    return 16
  }
}

const formatTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// 장면 전환 표시로 쓰는 줄 (*, ***, * * *, ---, #)
const SCENE_BREAK = /^\s*(\*\s*){1,3}$|^\s*-{3,}\s*$|^\s*#\s*$/

/** 원고 한 장을 책처럼 조판합니다. 문단 첫 줄 들여쓰기, 빈 줄은 문단 사이 여백, 장면 전환 줄은 가운데 장식. */
function PreviewChapter({ chapter, onEdit }) {
  const lines = chapter.text.split('\n')
  return (
    <section className="novel-preview__chapter" id={`novel-preview-${chapter.id}`}>
      <h2>
        <button type="button" onClick={onEdit} title="이 장 편집하기">
          {chapter.title || '(제목 없음)'}
        </button>
      </h2>
      {chapter.text.trim() ? (
        lines.map((line, i) =>
          SCENE_BREAK.test(line) ? (
            <p key={i} className="novel-preview__break" aria-label="장면 전환">⁂</p>
          ) : line.trim() ? (
            <p key={i}>{line.trim()}</p>
          ) : (
            <p key={i} className="novel-preview__blank" aria-hidden="true" />
          ),
        )
      ) : (
        <p className="novel-preview__empty">(아직 쓴 내용이 없습니다)</p>
      )}
    </section>
  )
}

/**
 * 책 미리보기. scope가 'chapter'면 고른 장만, 'all'이면 작품 전체를 이어서 보여 줍니다.
 * 장 제목을 누르면 그 장을 편집하러 돌아갑니다. Esc로도 편집으로 돌아갑니다.
 */
function BookPreview({ project, chapter, scope, fontSize, onScope, onEdit, onExit }) {
  const chapters = scope === 'all' ? project.chapters : [chapter]
  const chars = chapters.reduce((sum, c) => sum + countChars(c.text), 0)
  const pages = chapters.reduce((sum, c) => sum + manuscriptPages(c.text), 0)
  const scrollRef = useRef(null)

  // 열리자마자 Esc로 돌아갈 수 있게 미리보기에 포커스를 줍니다. (div에는 autoFocus가 듣지 않음)
  useEffect(() => scrollRef.current?.focus({ preventScroll: true }), [])

  // 전체 원고에서 왼쪽 목록으로 장을 고르면 그 장으로 스크롤합니다.
  useEffect(() => {
    if (scope !== 'all' || !chapter) return
    scrollRef.current?.querySelector(`#novel-preview-${CSS.escape(chapter.id)}`)?.scrollIntoView({ block: 'start' })
  }, [scope, chapter?.id])

  return (
    <div
      className="novel-preview"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onExit()
        }
      }}
    >
      <div className="novel-preview__bar">
        <button type="button" onClick={onExit}>◀ 편집으로</button>
        <span className="novel-preview__scope" role="group" aria-label="미리보기 범위">
          <button type="button" aria-pressed={scope === 'chapter'} disabled={!chapter} onClick={() => onScope('chapter')}>
            이 장
          </button>
          <button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>
            전체 원고
          </button>
        </span>
        <span className="novel-preview__info">
          {chars.toLocaleString()}자 · 원고지 약 {Math.ceil(pages).toLocaleString()}매
        </span>
      </div>
      <div className="novel-preview__desk" ref={scrollRef} tabIndex={-1}>
        <article className="novel-preview__page" style={{ fontSize }} aria-label="책 미리보기">
          {scope === 'all' && (
            <header className="novel-preview__cover">
              <h1>{project.title}</h1>
              {project.logline && <p>{project.logline}</p>}
            </header>
          )}
          {chapters.map((c) => (
            <PreviewChapter key={c.id} chapter={c} onEdit={() => onEdit(c.id)} />
          ))}
        </article>
      </div>
    </div>
  )
}

/** 작품 목록: 프로그램을 처음 열었거나 작품을 닫았을 때 보이는 화면 */
function ProjectList({ projects, onOpen, onCreate, onDelete }) {
  return (
    <div className="novel-home">
      <div className="novel-home__intro">
        <PixelIcon name="fountain-pen" size={32} />
        <div>
          <strong>소설 집필</strong>
          <p>원고를 장별로 나눠 쓰고, 인물과 설정을 옆에 두고 볼 수 있습니다. 작품은 지금 연 서재 파일 안에 함께 저장됩니다.</p>
        </div>
      </div>
      <div className="novel-home__actions">
        <button type="button" onClick={onCreate}>새 작품</button>
      </div>
      {projects.length > 0 ? (
        <ul className="novel-home__list">
          {projects.map((p) => (
            <li key={p.id}>
              <button type="button" className="novel-home__open" onClick={() => onOpen(p.id)}>
                <strong>{p.title}</strong>
                <span>
                  {p.chars.toLocaleString()}자 · {new Date(p.updatedAt).toLocaleDateString('ko-KR')} 수정
                </span>
              </button>
              <button type="button" className="danger" onClick={() => onDelete(p)}>삭제</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="novel-home__empty">아직 작품이 없습니다. "새 작품"으로 시작해 보세요.</p>
      )}
    </div>
  )
}

/**
 * "소설 집필" 프로그램. 서재의 책과는 별개로 작품(원고 장/인물/자료)을 쓰고 관리합니다.
 * 작품은 서재 DB의 novels 등 테이블에 저장됩니다. 고친 내용은 잠시 뒤 서재에 반영되고,
 * 서재 파일에 쓰는 것은 다른 기능처럼 서재 저장(Ctrl+S, 자동 저장)이 합니다.
 * 서재가 바뀌면 App이 key로 이 창을 새로 만듭니다.
 */
export default function NovelWindow({ libraryId, novels, loadNovel, saveNovel, removeNovel, onSaveLibrary, onClose, registerEditor }) {
  const dialog = useDialog()
  const [project, setProject] = useState(() => {
    const last = readLastProjectId(libraryId)
    return last ? loadNovel(last) : null
  })
  const [tab, setTab] = useState('chapters')
  const [selected, setSelected] = useState(() => project?.chapters[0]?.id || null)
  const [focusMode, setFocusMode] = useState(false)
  const [fontSize, setFontSize] = useState(readFontSize)
  const [saveError, setSaveError] = useState(null)
  const [sprint, setSprint] = useState(null) // { endsAt, minutes, startChars }
  const [now, setNow] = useState(Date.now())
  const [prompt, setPrompt] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, value } 목록에서 이름을 고치는 중인 항목
  const [preview, setPreview] = useState(null) // null(편집) | 'chapter'(이 장) | 'all'(전체 원고)
  const paperRef = useRef(null)

  // ---- 서재에 반영 ----
  // 글자를 칠 때마다 DB를 다시 쓰지 않도록 잠시 모았다가 한 번에 반영합니다.
  const pendingRef = useRef(null) // 아직 서재에 반영하지 않은 작품
  const flush = () => {
    const p = pendingRef.current
    if (!p) return true
    try {
      saveNovel(p, totalChars(p), libraryId)
      pendingRef.current = null
      setSaveError(null)
      return true
    } catch (err) {
      setSaveError(err.message || String(err))
      return false
    }
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(() => {
    if (!pendingRef.current) return undefined
    const timer = setTimeout(() => flushRef.current(), 800)
    return () => clearTimeout(timer)
  }, [project])

  // 창이 닫히면 남은 내용을 바로 서재에 반영합니다.
  useEffect(() => () => flushRef.current(), [])

  // Ctrl+S: 작품을 서재에 반영한 뒤 서재 파일을 저장합니다.
  useEffect(() =>
    registerEditor?.({
      save: () => flushRef.current() && onSaveLibrary(),
      confirmClose: async () =>
        flushRef.current() ||
        dialog.confirm('마지막 변경을 서재에 반영하지 못했습니다. 그래도 닫을까요?', {
          title: '소설 집필',
          okLabel: '닫기',
        }),
    }),
  )

  useEffect(() => {
    try {
      localStorage.setItem(FONT_KEY, String(fontSize))
    } catch {
      // 글꼴 크기는 이번에만 적용됩니다.
    }
  }, [fontSize])

  // ---- 집필 스프린트 타이머 ----
  useEffect(() => {
    if (!sprint) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [sprint])

  const total = project ? totalChars(project) : 0

  useEffect(() => {
    if (!sprint || now < sprint.endsAt) return
    const written = Math.max(0, total - sprint.startChars)
    setSprint(null)
    dialog.alert(`${sprint.minutes}분 동안 ${written.toLocaleString()}자를 썼습니다. 잠깐 쉬었다 가세요.`, {
      title: '집필 스프린트 끝',
    })
  }, [now, sprint, total, dialog])

  // ---- 작품 다루기 ----
  const openProject = (p) => {
    flush()
    setProject(p)
    setTab('chapters')
    setSelected(p?.chapters[0]?.id || null)
    setSprint(null)
    writeLastProjectId(libraryId, p?.id)
  }

  /** 작품을 고칩니다. 오늘 처음 고치는 것이면 오늘 쓴 분량의 기준점을 남깁니다. */
  const update = (fn) => {
    setProject((p) => {
      const day = todayKey()
      const progress = p.progress?.[day] ? p.progress : { ...p.progress, [day]: { start: totalChars(p) } }
      const next = { ...fn(p), progress }
      pendingRef.current = next
      return next
    })
  }

  const handleCreate = () => {
    const p = createProject()
    try {
      flush()
      saveNovel(p, 0, libraryId)
    } catch (err) {
      dialog.alert(err.message || '작품을 만들지 못했습니다.', { title: '소설 집필' })
      return
    }
    openProject(p)
  }

  const handleDeleteProject = async (p) => {
    const ok = await dialog.confirm(
      `"${p.title}"을(를) 삭제할까요? 장, 인물, 자료가 모두 서재에서 지워집니다.`,
      { title: '작품 삭제', okLabel: '삭제' },
    )
    if (!ok) return
    try {
      if (project?.id === p.id) {
        pendingRef.current = null
        setProject(null)
        writeLastProjectId(libraryId, null)
      }
      removeNovel(p.id, libraryId)
    } catch (err) {
      dialog.alert(err.message, { title: '작품 삭제' })
    }
  }

  const pickPrompt = () => {
    const others = WRITING_PROMPTS.filter((p) => p !== prompt)
    setPrompt(others[Math.floor(Math.random() * others.length)])
  }

  const startSprint = (minutes) => {
    setNow(Date.now())
    setSprint({ minutes, endsAt: Date.now() + minutes * 60_000, startChars: total })
  }

  // ---- 목록(장/인물/자료) ----
  const listKey = tab
  const items = project ? project[listKey] : []
  const current = items.find((i) => i.id === selected) || null

  const selectTab = (key) => {
    commitRename(false)
    setTab(key)
    setSelected(project[key][0]?.id || null)
  }

  const addItem = () => {
    const id = newId()
    const item = {
      chapters: { id, title: `${project.chapters.length + 1}장`, synopsis: '', text: '' },
      characters: { id, name: '새 인물', role: '', memo: CHARACTER_TEMPLATE },
      notes: { id, title: '새 메모', text: '' },
    }[listKey]
    // 고른 항목 바로 뒤에 넣습니다.
    update((p) => {
      const list = [...p[listKey]]
      const at = list.findIndex((i) => i.id === selected)
      list.splice(at === -1 ? list.length : at + 1, 0, item)
      return { ...p, [listKey]: list }
    })
    setSelected(id)
    // 새 항목은 바로 이름부터 정할 수 있게 합니다.
    setRenaming({ id, value: item.title ?? item.name })
  }

  // ---- 목록에서 이름 바꾸기 (두 번 클릭, F2, "이름" 버튼) ----
  const nameField = listKey === 'characters' ? 'name' : 'title'

  const startRename = (item) => setRenaming({ id: item.id, value: item[nameField] })

  const commitRename = (focusPaper) => {
    if (!renaming) return
    const { id, value } = renaming
    setRenaming(null)
    update((p) => ({ ...p, [listKey]: p[listKey].map((i) => (i.id === id ? { ...i, [nameField]: value.trim() } : i)) }))
    if (focusPaper) requestAnimationFrame(() => paperRef.current?.focus())
  }

  const moveItem = (offset) => {
    const at = items.findIndex((i) => i.id === selected)
    const to = at + offset
    if (at === -1 || to < 0 || to >= items.length) return
    update((p) => {
      const list = [...p[listKey]]
      ;[list[at], list[to]] = [list[to], list[at]]
      return { ...p, [listKey]: list }
    })
  }

  const removeItem = async () => {
    if (!current) return
    const name = current.title || current.name
    const hasContent = (current.text || current.memo || '').trim() && current.memo !== CHARACTER_TEMPLATE
    if (hasContent) {
      const ok = await dialog.confirm(`"${name}"을(를) 삭제할까요? 되돌릴 수 없습니다.`, {
        title: '삭제',
        okLabel: '삭제',
      })
      if (!ok) return
    }
    const at = items.findIndex((i) => i.id === current.id)
    const rest = items.filter((i) => i.id !== current.id)
    update((p) => ({ ...p, [listKey]: p[listKey].filter((i) => i.id !== current.id) }))
    setSelected(rest[Math.min(at, rest.length - 1)]?.id || null)
  }

  // 미리보기할 장: 원고 탭에서 고른 장, 다른 탭이면 없음(전체 원고만 볼 수 있음)
  const previewChapter = tab === 'chapters' ? current : null

  const editChapter = (id) => {
    setPreview(null)
    setTab('chapters')
    setSelected(id)
  }

  const editCurrent = (fields) =>
    update((p) => ({ ...p, [listKey]: p[listKey].map((i) => (i.id === current.id ? { ...i, ...fields } : i)) }))

  // ---- 화면 ----
  if (!project) {
    return (
      <div className="novel">
        <MenuBar
          menus={[
            {
              label: '파일(F)',
              items: [
                { label: '새 작품', onClick: handleCreate },
                { separator: true },
                { label: '닫기', onClick: () => onClose() },
              ],
            },
          ]}
        />
        <ProjectList
          projects={novels}
          onOpen={(id) => openProject(loadNovel(id))}
          onCreate={handleCreate}
          onDelete={handleDeleteProject}
        />
      </div>
    )
  }

  const todayStart = project.progress?.[todayKey()]?.start
  const todayWritten = todayStart === undefined ? 0 : Math.max(0, total - todayStart)
  const goal = project.dailyGoal || 0
  const goalRatio = goal ? Math.min(1, todayWritten / goal) : 0
  const pages = project.chapters.reduce((sum, c) => sum + manuscriptPages(c.text), 0)

  const menus = [
    {
      label: '파일(F)',
      items: [
        { label: '새 작품', onClick: handleCreate },
        { label: '작품 목록...', onClick: () => openProject(null) },
        { separator: true },
        { label: '서재 저장', shortcut: 'Ctrl+S', onClick: () => flush() && onSaveLibrary() },
        { label: '원고 내보내기(.txt)', onClick: () => exportManuscript(project) },
        { separator: true },
        { label: '작품 삭제...', onClick: () => handleDeleteProject(project) },
        { separator: true },
        { label: '닫기', onClick: () => onClose() },
      ],
    },
    {
      label: '보기(V)',
      items: [
        { label: '집중 모드', checked: focusMode, onClick: () => setFocusMode(!focusMode) },
        { separator: true },
        {
          label: '미리보기: 이 장',
          checked: preview === 'chapter',
          disabled: !previewChapter,
          onClick: () => setPreview(preview === 'chapter' ? null : 'chapter'),
        },
        { label: '미리보기: 전체 원고', checked: preview === 'all', onClick: () => setPreview(preview === 'all' ? null : 'all') },
        { separator: true },
        { label: '글자 크게', onClick: () => setFontSize((s) => Math.min(28, s + 2)) },
        { label: '글자 작게', onClick: () => setFontSize((s) => Math.max(12, s - 2)) },
      ],
    },
    {
      label: '도구(T)',
      items: [
        ...[15, 25, 45].map((m) => ({ label: `집필 스프린트 ${m}분`, onClick: () => startSprint(m) })),
        { label: '스프린트 그만두기', disabled: !sprint, onClick: () => setSprint(null) },
        { separator: true },
        { label: '글감 뽑기', onClick: pickPrompt },
      ],
    },
  ]

  return (
    <div className={`novel${focusMode ? ' is-focus' : ''}`}>
      <MenuBar menus={menus} />

      <div className="novel__body">
        {!focusMode && (
          <aside className="novel__side">
            <input
              className="novel__project-title"
              value={project.title}
              aria-label="작품 제목"
              onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              className="novel__logline"
              value={project.logline}
              placeholder="한 줄 요약 (로그라인)"
              aria-label="한 줄 요약"
              onChange={(e) => update((p) => ({ ...p, logline: e.target.value }))}
            />
            <div className="novel__tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={tab === t.key ? 'is-active' : ''}
                  onClick={() => selectTab(t.key)}
                >
                  {t.label} ({project[t.key].length})
                </button>
              ))}
            </div>
            <ul className="novel__list" role="listbox" aria-label={TABS.find((t) => t.key === tab).label}>
              {items.map((item) => (
                <li key={item.id}>
                  {renaming?.id === item.id ? (
                    <input
                      className="novel__rename"
                      value={renaming.value}
                      aria-label="이름 바꾸기"
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                      onBlur={() => commitRename(false)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return // 한글 조합 중 Enter는 글자 확정입니다
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename(true)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          e.stopPropagation()
                          setRenaming(null)
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === selected}
                      className={item.id === selected ? 'is-selected' : ''}
                      title="두 번 클릭하거나 F2를 누르면 이름을 바꿉니다"
                      onClick={() => setSelected(item.id)}
                      onDoubleClick={() => startRename(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'F2') {
                          e.preventDefault()
                          startRename(item)
                        }
                      }}
                    >
                      <span>{(item.title ?? item.name) || '(제목 없음)'}</span>
                      {tab === 'chapters' && <small>{countChars(item.text).toLocaleString()}</small>}
                      {tab === 'characters' && item.role && <small>{item.role}</small>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="novel__list-actions">
              <button type="button" onClick={addItem} title="추가">추가</button>
              <button type="button" onClick={() => startRename(current)} disabled={!current} title="이름 바꾸기 (F2)">이름</button>
              <button type="button" onClick={() => moveItem(-1)} disabled={!current} title="위로">▲</button>
              <button type="button" onClick={() => moveItem(1)} disabled={!current} title="아래로">▼</button>
              <button type="button" onClick={removeItem} disabled={!current} title="삭제">삭제</button>
            </div>
          </aside>
        )}

        <section className="novel__editor">
          {preview ? (
            <BookPreview
              project={project}
              chapter={previewChapter}
              scope={preview === 'chapter' && !previewChapter ? 'all' : preview}
              fontSize={fontSize}
              onScope={setPreview}
              onEdit={editChapter}
              onExit={() => setPreview(null)}
            />
          ) : (
            <>
            {prompt && (
              <div className="novel__prompt" role="status">
                <span>💡 {prompt}</span>
                <button type="button" onClick={pickPrompt}>다른 글감</button>
                <button type="button" onClick={() => setPrompt(null)} aria-label="글감 닫기">✕</button>
              </div>
            )}

            {!current ? (
              <p className="novel__placeholder">왼쪽에서 항목을 고르거나 "추가"를 눌러 시작하세요.</p>
            ) : tab === 'chapters' ? (
              <>
                <div className="novel__heading-row">
                  <input
                    className="novel__heading"
                    value={current.title}
                    aria-label="장 제목"
                    onChange={(e) => editCurrent({ title: e.target.value })}
                  />
                  <button type="button" onClick={() => setPreview('chapter')} title="책처럼 조판해서 봅니다">
                    미리보기
                  </button>
                </div>
                {!focusMode && (
                  <textarea
                    className="novel__synopsis"
                    rows={2}
                    value={current.synopsis}
                    placeholder="이 장의 줄거리 메모 (원고 내보내기에는 들어가지 않습니다)"
                    aria-label="장 줄거리"
                    onChange={(e) => editCurrent({ synopsis: e.target.value })}
                  />
                )}
                <textarea
                  key={current.id}
                  ref={paperRef}
                  className="novel__paper"
                  style={{ fontSize }}
                  value={current.text}
                  placeholder="여기에 원고를 쓰세요."
                  aria-label="원고"
                  spellCheck={false}
                  autoFocus={renaming?.id !== current.id}
                  onChange={(e) => editCurrent({ text: e.target.value })}
                />
              </>
            ) : tab === 'characters' ? (
              <>
                <div className="novel__fields">
                  <label>
                    이름
                    <input value={current.name} onChange={(e) => editCurrent({ name: e.target.value })} />
                  </label>
                  <label>
                    역할
                    <input
                      value={current.role}
                      placeholder="주인공, 조력자, 적대자..."
                      onChange={(e) => editCurrent({ role: e.target.value })}
                    />
                  </label>
                </div>
                <textarea
                  key={current.id}
                  ref={paperRef}
                  className="novel__paper novel__paper--memo"
                  value={current.memo}
                  aria-label="인물 메모"
                  onChange={(e) => editCurrent({ memo: e.target.value })}
                />
              </>
            ) : (
              <>
                <input
                  className="novel__heading"
                  value={current.title}
                  aria-label="메모 제목"
                  onChange={(e) => editCurrent({ title: e.target.value })}
                />
                <textarea
                  key={current.id}
                  ref={paperRef}
                  className="novel__paper novel__paper--memo"
                  value={current.text}
                  placeholder="세계관, 장소, 연표, 떠오른 아이디어..."
                  aria-label="메모"
                  onChange={(e) => editCurrent({ text: e.target.value })}
                />
              </>
            )}
            </>
          )}
        </section>
      </div>

      <div className="novel__status">
        <span className="novel__status-cell">
          {tab === 'chapters' && current ? `이 장 ${countChars(current.text).toLocaleString()}자 · ` : ''}
          전체 {total.toLocaleString()}자 · 원고지 약 {Math.ceil(pages).toLocaleString()}매
        </span>
        <span className="novel__status-cell novel__goal">
          오늘 {todayWritten.toLocaleString()}
          <label>
            /
            <input
              type="number"
              min={0}
              step={100}
              value={goal}
              aria-label="하루 목표 글자 수"
              onChange={(e) => update((p) => ({ ...p, dailyGoal: Math.max(0, Number(e.target.value) || 0) }))}
            />
            자
          </label>
          <span className="novel__meter" aria-hidden="true">
            <span style={{ width: `${goalRatio * 100}%` }} />
          </span>
        </span>
        {sprint && (
          <span className="novel__status-cell">
            ⏱ {formatTime(sprint.endsAt - now)} · +{Math.max(0, total - sprint.startChars).toLocaleString()}자
          </span>
        )}
        {saveError && (
          <span className="novel__status-cell novel__save" role="alert">
            ⚠ {saveError}
          </span>
        )}
      </div>
    </div>
  )
}
