import PixelIcon from './PixelIcon'

/**
 * 시계를 빠르게 여러 번 누르면 나오는 이스터에그. Windows의 "정보" 창처럼 크레딧이 위로 흘러갑니다.
 * bookCount/quoteCount: 서재를 열어 둔 경우에만 넘어오며, 마지막에 작게 보여 줍니다.
 */
export default function CreditsWindow({ bookCount, quoteCount, onClose }) {
  const hasStats = bookCount !== null

  return (
    <div className="credits">
      <div className="credits__head">
        <span className="credits__icon">
          <PixelIcon name="library" size={32} />
        </span>
        <div>
          <strong>
            Library<span className="credits__98">98</span>
          </strong>
          <div>버전 0.98 (Build 1998.09)</div>
        </div>
      </div>

      <div className="credits__screen" aria-label="크레딧">
        <div className="credits__roll">
          <p className="credits__h">— CREDITS —</p>
          <p>
            기획 · 디자인 · 개발
            <br />
            <strong>이 서재의 주인</strong>
          </p>
          <p>
            코딩 도우미
            <br />
            <strong>Claude</strong>
          </p>
          <p className="credits__h">사용한 것들</p>
          <p>
            React · Vite · sql.js
            <br />
            Toast UI Editor · Fuse.js
            <br />
            Kakao 도서 검색 · Google Drive
          </p>
          <p className="credits__h">특별히 감사한 분들</p>
          <p>
            읽어 주신 모든 작가님
            <br />
            그리고 아직 안 읽은 책들
          </p>
          {hasStats && (
            <p>
              지금까지 모은 책 <strong>{bookCount}권</strong>
              <br />
              간직한 인용구 <strong>{quoteCount}개</strong>
            </p>
          )}
          <p className="credits__h">오늘도 한 페이지만 더 :)</p>
        </div>
      </div>

      <div className="credits__buttons">
        <button type="button" className="quote-dialog__btn" onClick={onClose} autoFocus>
          확인
        </button>
      </div>
    </div>
  )
}
