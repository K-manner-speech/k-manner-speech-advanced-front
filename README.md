# K-Manner Speech Frontend

React + TypeScript + Vite 기반 로컬 시연용 프론트엔드입니다. 애플리케이션 데이터는 FastAPI만 호출하고, 브라우저는 로그인에 한해 Supabase Auth를 직접 사용합니다.

- 기술 스택: React, TypeScript, Vite, React Router, TanStack Query, Zustand, Supabase Auth
- API 계약: FastAPI OpenAPI + openapi-typescript/openapi-fetch
- 시연 범위: 로그인·온보딩, 홈(출석·연속 학습·오늘의 추천), 연습 선택, 자유채팅·상황 시나리오·이력서 기반 면접, 텍스트·음성 입력, 실시간 TTS 재생, 대화방 목록·삭제, 결과 복습, 내 정보·보안

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

브라우저에서 `http://localhost:5173/login`을 엽니다. Vite dev 서버는 IPv6 `[::1]:5173`에만 바인딩되므로
`http://127.0.0.1:5173`으로는 열리지 않습니다. IPv4 로 열려면 `npm run dev -- --host 127.0.0.1`을 사용합니다.
브라우저는 `localhost`와 `127.0.0.1`을 다른 사이트로 취급해 로그인 세션이 따로 관리되므로, 한 세션 안에서
두 주소를 섞지 않습니다.

API 와 base queue worker 네 개(`conversation_text`, `interactive_ai`, `evaluation_ai`, `document_analysis`)는
백엔드 저장소에서 별도로 실행해야 합니다. worker 를 빠뜨리면 로그인과 화면은 정상 동작하지만 메시지 전송,
음성 생성, 피드백과 결과 생성이 응답 없이 타임아웃됩니다.

## 검증

```powershell
npm run lint
npm run typecheck
npm run test
npm run contract-check
npm run build
npm run e2e
```

실제 Supabase 로그인과 Catalog E2E는 API가 실행 중인 상태에서 `.env.test.example`을 `.env.test`로 복사하고 테스트 계정 및 Supabase 값을 입력하면 추가 실행됩니다.

```powershell
Copy-Item .env.test.example .env.test
npm run e2e
```

`.env.test`는 Git에서 제외되며 `.env.test.example`만 공유합니다. CI나 셸에서 같은 환경변수를 지정하면 해당 값이 `.env.test`보다 우선합니다. Service role key는 프론트 환경파일에 넣지 않습니다.

## OpenAPI

`openapi.json`은 FastAPI `/openapi.json`에서 고정한 artifact입니다. API 변경 후 다음 명령으로 TypeScript 타입을 다시 생성합니다.

```powershell
npm run openapi:generate
npm run contract-check
```

`src/api/generated/schema.d.ts`는 직접 수정하지 않습니다.

## 화면과 라우트

`src/app/router.tsx`가 단일 기준입니다. 화면 설계는 백엔드 저장소의 `docs/화면기획서.md`를 따릅니다.

| 경로 | 화면 | 접근 |
| --- | --- | --- |
| `/start`, `/login`, `/signup` | 시작·로그인·가입 | 비로그인 |
| `/onboarding` | 프로필·언어 온보딩 | 로그인 |
| `/` | 홈(출석·연속 학습·오늘의 추천) | 온보딩 완료 |
| `/practice` | 연습 선택(페르소나·시나리오) | 온보딩 완료 |
| `/rooms` | 대화방 목록·삭제 | 온보딩 완료 |
| `/rooms/:roomId` | 대화·면접 진행 | 온보딩 완료 |
| `/rooms/:roomId/interview-complete` | 면접 종료 확정 | 온보딩 완료 |
| `/rooms/:roomId/result` | 방에서 바로 보는 결과 | 온보딩 완료 |
| `/interview` | 면접 준비(자료 업로드·구성) | 온보딩 완료 |
| `/results`, `/results/:resultId` | 결과 목록·상세 | 온보딩 완료 |
| `/results/:resultId/scores` | 항목별 점수 | 온보딩 완료 |
| `/results/:resultId/strengths[/:key]` | 강점 목록·상세 | 온보딩 완료 |
| `/results/:resultId/improvements[/:key]` | 보완점 목록·상세 | 온보딩 완료 |
| `/me`, `/me/edit` | 내 정보·프로필 수정 | 온보딩 완료 |
| `/me/language/native`, `/me/language/display` | 모국어·표시 언어 | 온보딩 완료 |
| `/me/security`, `/me/security/password` | 보안·비밀번호 변경 | 온보딩 완료 |

이메일 변경 화면은 두지 않습니다. 가입 주소가 계정을 가리키는 이름이므로 `/me`에서 읽기 전용으로만 보여 줍니다.

## 실시간 TTS 재생

페르소나 음성은 두 경로로 재생합니다. 생성이 끝나기를 기다리지 않는 `GET /api/v1/messages/{message_id}/audio/stream`
중계 스트림(`s16le`·24kHz·mono PCM)을 AudioWorklet 으로 먼저 재생하고, 스트림을 쓸 수 없거나 끊기면
`GET /api/v1/messages/{message_id}/audio`의 완성 음성으로 되돌아갑니다. 스트림이 음성 전체 길이보다 짧게
끝난 경우에는 완성 음성의 남은 뒷부분만 이어서 재생합니다. 관련 코드는
`src/features/conversation/ttsStreaming.ts`와 `audioPlayback.ts`이며, 버퍼 정책은 `STREAMING_TTS_BUFFER_POLICY`
한 곳에서 정합니다.

## 브랜치

`develop`에서 `feature/*` 브랜치를 만들어 작업하고 PR 로 `develop`에 병합합니다. `main`에 직접 커밋하지 않습니다.
(저장소 최초 구현만 사용자 승인에 따라 예외적으로 `main`에서 진행했습니다.)
