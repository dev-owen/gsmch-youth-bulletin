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

운영 도메인과 Cloudflare·DB·Google OAuth 계정이 준비되면 [운영 배포와 점검](docs/operations.md)의 순서대로 진행합니다. `deployment/config.example.json`을 `deployment/config.local.json`으로 복사해 실제 주소·Hyperdrive ID·R2 버킷 이름을 채운 뒤 `npm run prepare:production`을 실행하면 운영용 Wrangler 설정, Pages 빌드 환경 파일, 고정 주소의 인쇄용 QR SVG가 생성됩니다. 이 파일들은 Git에 포함되지 않습니다.

운영 자격 증명이 없어도 `npm run build`로 웹과 API 배포 산출물을 확인할 수 있습니다. 실제 계정과 기기에서 확인할 항목은 [운영 문서](docs/operations.md)에, 공식 웹사이트에서 찾은 교회 안내 후보는 [교회 안내 검토 자료](docs/site-info-review.md)에 정리했습니다.

## API

공개 API는 `/v1/health`, `/v1/bulletins/current`, `/v1/bulletins`, `/v1/bulletins/:date`입니다. 관리자 API는 `/v1/admin/*`이고 모든 요청에서 Better Auth 세션과 `admin_users`를 검사합니다. 오류는 `{ "code": "...", "message": "..." }` 형태로 반환합니다. `GET /v1/bulletins/current`는 캐시하지 않아 발행 직후 같은 QR 주소에서 새 주보를 읽습니다.

## 참고 문서

- [모바일 주보 기획서](docs/gsmch-youth-bulletin-plan.md)
- [기술 설계 초안](docs/gsmch-youth-bulletin-technical-design-draft.md)
