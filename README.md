# 내 서재 (Library)

책을 읽고 목록을 관리하고, 독서감상문을 마크다운/HTML/일반 텍스트로 기록하는 개인용 웹 앱입니다.
서버 없이 정적 페이지로 동작하며, 데이터는 브라우저에서 다루는 SQLite 파일(`.db`)로 저장해 데스크탑에 직접 백업/보관합니다.

## 기술 스택

- Vite + React
- [sql.js](https://github.com/sql-js/sql.js) — 브라우저에서 동작하는 SQLite (WASM)
- File System Access API (+ 미지원 브라우저용 다운로드/업로드 fallback)
- [marked](https://github.com/markedjs/marked) + [DOMPurify](https://github.com/cure53/DOMPurify) — 마크다운/HTML 감상문 렌더링
- [@toast-ui/editor](https://ui.toast.com/tui-editor) — 마크다운 위지윅 에디터
- [Fuse.js](https://www.fusejs.io/) — 제목/저자/태그 검색

## 로컬에서 서버 수동 실행하기

### 1. 의존성 설치 (최초 1회, 또는 package.json 변경 후)

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

- 터미널에 뜨는 주소(기본값 `http://localhost:5173`)를 브라우저로 열면 됩니다.
- 코드를 수정하면 자동으로 새로고침(HMR)됩니다.
- 종료할 때는 터미널에서 `Ctrl + C`.

### 3. 프로덕션 빌드 결과를 로컬에서 미리보기

실제 배포본과 동일한 정적 파일로 동작을 확인하고 싶을 때 사용합니다.

```bash
npm run build     # dist/ 폴더에 정적 파일 생성
npm run preview   # dist/ 폴더를 로컬 서버로 서빙 (기본값 http://localhost:4173)
```

`npm run dev`(개발 모드)와 `npm run preview`(빌드 결과 미리보기)는 목적이 다르므로, 배포 전 최종 확인은 `preview`로 하는 것을 권장합니다.

## 데이터(서재 DB 파일) 사용법

1. 앱 상단 툴바에서 **"새 서재"**를 눌러 빈 서재를 만들거나, 기존에 저장해둔 `.db` 파일을 **"파일 열기"**로 불러옵니다.
2. 책 추가/수정, 감상문 작성은 모두 브라우저 메모리에서 즉시 반영됩니다.
3. 작업 내용을 실제 파일에 남기려면 **"저장"**을 눌러야 합니다.
   - Chrome/Edge: 처음 저장 시 파일 위치를 지정하면, 이후 저장은 그 파일에 자동으로 덮어씁니다.
   - Firefox/Safari 등: File System Access API를 지원하지 않아 저장할 때마다 새 파일이 다운로드됩니다. 원래 파일 위치에 수동으로 옮겨 덮어써 주세요.
4. `.db` 파일이 곧 전체 서재 데이터입니다. 백업하려면 이 파일을 복사해서 보관하면 됩니다(예: 클라우드 드라이브, USB 등).

## 배포 (GitHub Pages)

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드 후 GitHub Pages에 배포합니다.
리포지토리 Settings → Pages → Source를 **"GitHub Actions"**로 설정해야 동작합니다.
