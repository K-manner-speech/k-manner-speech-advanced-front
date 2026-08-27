# K-Manner Speech Frontend

React + TypeScript + Vite 기반 로컬 시연용 프론트엔드입니다. 애플리케이션 데이터는 FastAPI만 호출하고, 브라우저는 로그인에 한해 Supabase Auth를 직접 사용합니다.

- 기술 스택: React, TypeScript, Vite, React Router, TanStack Query, Zustand, Supabase Auth
- API 계약: FastAPI OpenAPI + openapi-typescript/openapi-fetch
- 시연 범위: 로그인, 최소 온보딩, Catalog, 텍스트 대화, 이력서 기반 면접, 결과

## 환경 변수

`.env.example`을 `.env.local`로 복사하고 아래 공개 값만 입력합니다.

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8010
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Service role key, DB URL, Gemini/OpenAI key는 프론트에 넣지 않습니다.

## 실행

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173/login`을 엽니다. API와 세 worker는 백엔드 저장소에서 별도 실행해야 합니다.

## 검증

```powershell
npm run lint
npm run typecheck
npm run test
npm run contract-check
npm run build
npm run e2e
```

실제 Supabase 로그인과 Catalog E2E는 API가 실행 중인 상태에서 `E2E_EMAIL`, `E2E_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 셸 환경변수로 제공하면 추가 실행됩니다. 자격 증명은 파일에 기록하지 않습니다.

## OpenAPI

`openapi.json`은 FastAPI `/openapi.json`에서 고정한 artifact입니다. API 변경 후 다음 명령으로 TypeScript 타입을 다시 생성합니다.

```powershell
npm run openapi:generate
npm run contract-check
```

`src/api/generated/schema.d.ts`는 직접 수정하지 않습니다.

이번 저장소 최초 구현은 사용자 승인에 따라 예외적으로 `main`에서 진행합니다. 이후 변경은 팀 Gitflow 규칙에 따라 `develop`에서 `feature/*` 브랜치를 만들어 작업합니다.
