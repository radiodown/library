import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 프로젝트 페이지(https://<user>.github.io/<repo>/)에 배포하려면
// base를 '/<repo>/'로 지정해야 합니다. .github/workflows/deploy.yml에서
// VITE_BASE_PATH 환경변수로 자동 주입합니다. 로컬 개발/미리보기는 기본값 '/'을 사용합니다.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
