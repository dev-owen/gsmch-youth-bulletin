# 선한목자 젊은이교회 모바일 주보

React + Vite 공개·관리자 웹, Hono + Better Auth Workers API, PostgreSQL, Cloudflare R2로 구성한 모바일 주보 프로토타입입니다. 공개 주소 `/`는 현재 발행본을 보여 주고, `/archive`와 `/bulletins/YYYY-MM-DD`에서 지난 발행본을 볼 수 있습니다. 관리자 화면은 `/admin`입니다.

## 구현 범위

- 주보 표지(선택적 이미지), 예배 순서·담당자, 설교, 홍보 카드 0~3개, 고정 교회 안내
- 주보 초안 생성 시 이전 발행본의 **예배 순서명만** 복제
- 저장과 발행 분리, 모바일 미리보기, 발행본 오탈자 수정
- 발행 트랜잭션으로 최신 주보 포인터 변경, 비공개 초안과 관리자 API 권한 검사
- 한 번 온라인에서 연 최신 주보 JSON과 대표 이미지를 저장하는 PWA

행사 신청, 일반 회원 화면, PDF, 알림, 영상 업로드는 기획서의 후속 범위입니다.

## 구조

```text
apps/web  React + Vite · Cloudflare Pages
apps/api  Hono + Better Auth · Cloudflare Workers
apps/api/db/schema.sql  서비스 데이터 스키마
```

## 로컬 준비

Node.js 22 이상과 PostgreSQL이 필요합니다.

1. `npm install`
2. PostgreSQL 데이터베이스를 만들고 `DATABASE_URL` 환경 변수를 설정합니다.
3. `apps/api/.dev.vars.example`을 `apps/api/.dev.vars`로, `apps/web/.env.example`을 `apps/web/.env.local`로 복사합니다. API 파일에 Better Auth 비밀값과 Google OAuth 키를 채웁니다. 비밀값은 32자 이상 난수로 생성합니다.
4. Better Auth 인증 테이블을 생성한 뒤 서비스 스키마를 적용합니다.

   ```sh
   cd apps/api
   export DATABASE_URL='postgres://...'
   export BETTER_AUTH_SECRET='...'
   npx auth migrate --config ./auth.config.ts --yes
   psql "$DATABASE_URL" -f db/schema.sql
   ```

5. `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`에 같은 `DATABASE_URL`을 설정합니다. `wrangler.jsonc`의 Hyperdrive `id`는 배포 전 실제 ID로 바꿉니다.
6. `npm run dev:api`와 `npm run dev:web`을 각각 실행합니다. 웹은 `http://localhost:5173`, API는 `http://localhost:8787`입니다.

Google OAuth 리디렉션 URI는 로컬에서 `http://localhost:8787/api/auth/callback/google`, 운영에서 `https://api.<도메인>/api/auth/callback/google`로 등록합니다. 관리자 계정으로 한 번 로그인한 뒤 DB 관리자가 해당 계정을 승인합니다.

```sh
cd apps/api
psql "$DATABASE_URL" -v admin_email='관리자 이메일' -f db/grant-admin.sql
```

승인을 취소할 때는 `DELETE FROM admin_users WHERE user_id = ...`를 실행합니다. 관리자 화면에서는 권한을 부여할 수 없습니다.

## CI와 테스트

GitHub Actions는 Pull Request, `main` 브랜치 푸시, 수동 실행에서 Node.js 22로 의존성을 설치하고 타입 검사, 테스트, 웹·API 빌드를 실행합니다. 같은 검증은 로컬에서 다음 명령으로 실행할 수 있습니다.

```sh
npm run ci
```

API 입력 스키마 테스트는 `apps/api/tests`에 추가합니다. 현재 테스트는 날짜, URL, 주보 입력과 교회 안내 검증을 다룹니다. Cloudflare 배포는 계정별 Worker·Pages 프로젝트, Hyperdrive ID, 도메인과 배포 비밀값 설정이 필요하므로 운영 값을 준비한 뒤 배포 자동화를 연결하세요.

## 배포 설정

1. 유료 관리형 PostgreSQL과 Cloudflare R2 버킷을 준비합니다. R2에는 공개 주보 이미지 전용 버킷을 사용합니다.
2. Hyperdrive를 DB에 연결하며 쿼리 캐시는 끕니다. 생성된 ID를 `apps/api/wrangler.jsonc`의 `HYPERDRIVE` 바인딩에 넣습니다.
3. `WEB_ORIGIN`, `BETTER_AUTH_URL`, `PUBLIC_MEDIA_BASE_URL`을 실제 `https://domain.com`, `https://api.domain.com`, `https://media.domain.com`으로 설정합니다. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`은 Wrangler secret으로 넣습니다. 운영 DB 연결 문자열은 Worker에 직접 넣지 않고 Hyperdrive에 설정합니다.
4. Pages 빌드 환경 변수 `VITE_API_BASE_URL=https://api.domain.com`과 `VITE_MEDIA_BASE_URL=https://media.domain.com`을 설정합니다. `npm run build`로 웹과 API의 배포 산출물을 만듭니다. Pages 빌드 명령은 `npm run build -w @bulletin/web`, 출력 폴더는 `apps/web/dist`입니다. `public/_redirects`가 날짜별 경로 새로고침을 앱으로 돌립니다.
5. Workers API를 `api.domain.com`에, Pages 웹을 `domain.com`에 연결합니다. 공개 R2 버킷의 커스텀 도메인을 `media.domain.com`에 연결합니다.
6. 실제 예배·모임 시간, 교회 소개와 비전, 주소·지도 링크를 관리자 화면에서 입력합니다. 샘플 운영 정보는 기본값에 포함하지 않았습니다.

Cloudflare 계정, DB, 실제 도메인 및 Google OAuth 키가 있어야 운영 배포와 기기별 로그인·오프라인 확인을 마칠 수 있습니다. 배포 전에 한국 모바일 브라우저와 카카오톡 내부 브라우저에서 OAuth 복귀, 발행 직후 갱신, 오프라인 표시를 확인하세요.

## API

공개 API는 `/v1/bulletins/current`, `/v1/bulletins`, `/v1/bulletins/:date`입니다. 관리자 API는 `/v1/admin/*`이고 모든 요청에서 Better Auth 세션과 `admin_users`를 검사합니다. 오류는 `{ "code": "...", "message": "..." }` 형태로 반환합니다. `GET /v1/bulletins/current`는 캐시하지 않아 발행 직후 같은 QR 주소에서 새 주보를 읽습니다.

## 참고 문서

- [모바일 주보 기획서](docs/gsmch-youth-bulletin-plan.md)
- [기술 설계 초안](docs/gsmch-youth-bulletin-technical-design-draft.md)
