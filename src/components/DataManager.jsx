/** 서재 DB 파일을 새로 만들기/열기/저장하기 위한 상단 툴바. */
export default function DataManager({
  isReady,
  isDirty,
  busy,
  fileName,
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
        <button onClick={() => onSave(false)} disabled={busy || !isReady}>
          저장
        </button>
        <button onClick={() => onSave(true)} disabled={busy || !isReady}>
          다른 이름으로 저장
        </button>
      </div>

      <div className="data-manager__status">
        {isReady ? (
          <>
            <span className="data-manager__filename">{fileName}</span>
            {isDirty && <span className="data-manager__dirty" title="저장되지 않은 변경사항이 있습니다">● 미저장</span>}
          </>
        ) : (
          <span>서재 파일을 열거나 새로 만들어 시작하세요.</span>
        )}
      </div>

      {!fsaSupported && (
        <p className="data-manager__notice">
          이 브라우저는 파일 자동 덮어쓰기를 지원하지 않습니다. "저장"을 누르면 새 파일이 다운로드되니,
          기존 파일 위치에 수동으로 옮겨 덮어써 주세요. (Chrome/Edge에서는 자동으로 덮어씁니다.)
        </p>
      )}
    </div>
  )
}
