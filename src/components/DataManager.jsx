/** 서재 DB 파일을 새로 만들기/열기/저장하기 위한 상단 툴바. */
export default function DataManager({
  isReady,
  isDirty,
  busy,
  fileName,
  lastSaved,
  canAutoSave,
  fsaSupported,
  onNew,
  onOpen,
  onSave,
}) {
  return (
    <div className="data-manager">
      <div className="data-manager__actions">
        <button onClick={onNew} disabled={busy}>
          새 서재
        </button>
        <button onClick={onOpen} disabled={busy}>
          파일 열기
        </button>
        <button onClick={() => onSave(false)} disabled={busy || !isReady} title="Ctrl+S (⌘S)">
          저장
        </button>
        <button
          onClick={() => onSave(true)}
          disabled={busy || !isReady}
          title="Ctrl+Shift+S (⌘⇧S)"
        >
          다른 이름으로 저장
        </button>
      </div>

      <div className="data-manager__status">
        {isReady ? (
          <>
            <span className="data-manager__filename">{fileName}</span>
            {isDirty && <span className="data-manager__dirty" title="저장되지 않은 변경사항이 있습니다">● 미저장</span>}
            {lastSaved && (
              <span className="data-manager__saved">
                {lastSaved.auto ? '자동 ' : ''}저장{' '}
                {lastSaved.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {fsaSupported && (
              <span className="data-manager__autosave">
                {canAutoSave
                  ? '자동 저장 켜짐 (1분마다)'
                  : '한 번 저장하면 1분마다 자동 저장됩니다'}
              </span>
            )}
          </>
        ) : (
          <span>서재 파일을 열거나 새로 만들어 시작하세요.</span>
        )}
      </div>

      {!fsaSupported && (
        <p className="data-manager__notice">
          이 브라우저는 파일 자동 덮어쓰기를 지원하지 않아 자동 저장도 쓸 수 없습니다. Ctrl+S(⌘S)나
          "저장"을 누르면 새 파일이 다운로드되니, 기존 파일 위치에 수동으로 옮겨 덮어써 주세요.
          (Chrome/Edge에서는 자동으로 덮어쓰고 1분마다 자동 저장합니다.)
        </p>
      )}
    </div>
  )
}
