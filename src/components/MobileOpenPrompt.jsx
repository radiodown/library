import PixelIcon from './PixelIcon'

/** 모바일에서 서재 파일을 아직 열지 않았을 때 각 창에 보여 주는 안내와 열기 버튼. */
export default function MobileOpenPrompt({
  busy,
  error,
  lastLibrary,
  openLibrary,
  restoreLastLibrary,
}) {
  return (
    <div className="m-open">
      <p>
        모바일에서는 <strong>보기 전용</strong>입니다. 책 목록, 감상문, 인용구, 통계를 읽을 수 있고
        작성과 수정은 PC에서 하세요.
      </p>

      {lastLibrary && (
        <button type="button" className="m-primary" onClick={restoreLastLibrary} disabled={busy}>
          <span>
            <PixelIcon name="book-open" className="pixel-icon--inline" />
            마지막 서재 불러오기
          </span>
          <small>
            {lastLibrary.name} · {new Date(lastLibrary.savedAt).toLocaleDateString('ko-KR')}에 연 파일
          </small>
        </button>
      )}
      <button type="button" onClick={openLibrary} disabled={busy}>
        <span>
          <PixelIcon name="folder-open" className="pixel-icon--inline" />
          서재 파일 열기
        </span>
      </button>

      {error && (
        <p className="m-error">
          <PixelIcon name="warning" className="pixel-icon--inline" />
          {error}
        </p>
      )}

      <p className="m-hint">
        PC에서 저장한 서재 파일(.db)을 iCloud Drive나 구글 드라이브 같은 곳에 두면 폰에서 선택할 수
        있습니다. 한 번 열면 이 기기에 사본이 보관되어 다음부터는 &quot;마지막 서재 불러오기&quot;로 바로
        열립니다. 사본은 연 시점의 내용이라, PC에서 바뀐 내용은 파일을 다시 열어야 반영됩니다.
      </p>
    </div>
  )
}
