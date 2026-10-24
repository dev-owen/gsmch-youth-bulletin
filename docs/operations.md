# 운영 배포와 점검

이 문서는 실제 도메인, Cloudflare 계정, PostgreSQL, Google OAuth 앱이 준비된 뒤 실행할 절차입니다. 설정 값이 미정인 상태에서 공개 배포를 진행하지 않습니다.

## 1. 도메인과 생성 파일

`deployment/config.example.json`을 `deployment/config.local.json`으로 복사하고 실제 웹·API·미디어 HTTPS 주소, Hyperdrive ID, R2 버킷 이름을 입력합니다. 파일은 Git에서 제외됩니다. 다음 명령은 운영용 Wrangler 설정과 Pages 빌드 환경 파일을 생성합니다.

웹과 API는 같은 등록 가능 도메인의 호스트 이름을 사용해 브라우저 세션 쿠키가 정상 동작하도록 구성합니다. 예를 들어 웹이 `bulletin.example.org`라면 API는 `api.example.org`처럼 같은 사이트에 둡니다.

```sh
npm run prepare:production
```

생성되는 파일은 `apps/api/wrangler.production.jsonc`와 `apps/web/.env.production.local`입니다. QR은 실제 공개 주소가 확정되고 연결된 뒤 `/` 주소로 한 번 제작합니다. 주보를 발행할 때마다 새 QR을 만들 필요는 없습니다.

Pages를 Git 연동으로 빌드한다면 대시보드에도 `VITE_API_BASE_URL`과 `VITE_MEDIA_BASE_URL`을 같은 값으로 등록합니다. 로컬 생성 파일은 Git에 포함되지 않습니다. Pages의 빌드 명령은 `npm ci && npm run build -w @bulletin/web`, 출력 폴더는 `apps/web/dist`입니다.

## 2. PostgreSQL과 복구

복구 기능이 있는 유료 관리형 PostgreSQL을 선택하고 백업 가능 기간, DB 지역, 용량, 접근 제한을 확인합니다. Render를 사용한다면 [유료 DB 시점 복구 문서](https://render.com/docs/postgresql-backups)에 따라 별도 복구 인스턴스로 되살려 원본을 건드리지 않고 검증할 수 있습니다. DB 제공자가 달라도 **실제 복구 시험**을 배포 전 수행합니다.

실제 DB를 만든 뒤 `DATABASE_URL`을 로컬 셸에만 설정하고 다음 순서로 적용합니다.

```sh
cd apps/api
npx auth migrate --config ./auth.config.ts --yes
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
```

`BETTER_AUTH_SECRET`도 이 셸에 설정해야 합니다. 운영 비밀값은 Git에 넣지 않습니다. `auth.config.ts`는 CLI가 인증 테이블을 만드는 데 사용합니다.

주기적인 논리 백업은 다음처럼 **접근이 제한된 저장 위치**에 만들 수 있습니다. 파일에는 사용자·세션 정보가 포함될 수 있습니다.

```sh
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file=backup.dump
pg_restore --list backup.dump
```

복원 시험은 운영 DB와 다른 빈 테스트 DB에만 수행합니다. `RESTORE_TEST_DATABASE_URL`이 운영 DB를 가리키지 않는지 호스트와 DB 이름을 확인한 뒤 다음 명령을 사용합니다.

```sh
pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" --no-owner --no-privileges backup.dump
psql "$RESTORE_TEST_DATABASE_URL" -c 'SELECT count(*) FROM site_info;'
psql "$RESTORE_TEST_DATABASE_URL" -c 'SELECT count(*) FROM bulletins;'
```

테이블과 최근 발행본·관리자 권한을 확인하고, 테스트 DB를 폐기합니다. 시점 복구를 사용하는 경우에도 별도 복구 인스턴스에서 같은 내용을 확인합니다. PostgreSQL의 [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)와 [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html) 문서를 참고합니다.

## 3. Cloudflare 자원과 비밀값

Cloudflare 계정에 Wrangler로 로그인한 뒤 `npx wrangler whoami`로 사용할 계정을 확인합니다. 처음 R2를 사용한다면 대시보드의 **Storage & databases → R2 → Overview**에서 R2 구독을 활성화해야 합니다. 활성화 전 `npx wrangler r2 bucket list`는 오류 `10042`를 반환할 수 있습니다. [R2 시작 안내](https://developers.cloudflare.com/r2/get-started/)에 따라 계정에서 이 단계를 마친 뒤 공개 주보 이미지 전용 버킷을 만듭니다. [R2 공개 버킷 안내](https://developers.cloudflare.com/r2/buckets/public-buckets/)에 따라 미디어 도메인을 버킷에 연결합니다. `r2.dev` 개발 주소 대신 운영 커스텀 도메인을 사용합니다. 버킷에는 개인정보나 비공개 파일을 넣지 않습니다.

Hyperdrive는 DB 연결 문자열로 만들고 **쿼리 캐시를 끕니다**. DB 연결 문자열은 셸 기록과 로그에 남지 않도록 입력 방법을 점검합니다. 생성된 ID를 `config.local.json`에 기록합니다.

```sh
npx wrangler hyperdrive create gsmch-youth-bulletin --connection-string="<DB 연결 문자열>" --caching-disabled
```

운영용 Worker의 필수 비밀값은 `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`입니다. 생성된 Wrangler 설정의 `secrets.required`가 누락을 검사합니다. 비밀값은 Cloudflare 대시보드의 Worker 설정에서 입력하거나 Wrangler의 비밀값 명령으로 넣습니다. [Wrangler `secret put`은 즉시 새 Worker 버전을 배포](https://developers.cloudflare.com/workers/configuration/secrets/)하므로 공개 전과 코드 배포 순서를 조율합니다.

`apps/api`에서 `wrangler.production.jsonc`를 검토한 뒤 Workers API를 배포합니다. 이 설정에는 API 호스트의 Cloudflare Custom Domain이 포함되어 있으며, [Cloudflare의 Custom Domain 조건](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)에 따라 활성화된 소유 zone과 충돌하지 않는 DNS가 필요합니다. 웹은 [Pages Git 연동](https://developers.cloudflare.com/pages/get-started/git-integration/)으로 배포하고 공개 도메인을 연결합니다. Google OAuth 앱에는 생성된 `apiOrigin` 뒤에 `/api/auth/callback/google`을 붙인 주소를 승인된 리디렉션 URI로 등록합니다. 최초 관리자 계정이 로그인한 뒤 `db/grant-admin.sql`로 승인합니다.

## 4. 공개 전 확인

- 공개 웹 `/`에서 초안이 노출되지 않고 현재 발행본만 보이는지 확인합니다.
- 발행 후 같은 `/` 주소가 새 주보를 반환하고 이전 주보가 날짜별 주소에 남는지 확인합니다.
- 관리자 권한이 없는 계정과 비로그인 요청으로 초안 조회·저장·발행·업로드가 거부되는지 확인합니다.
- 새 이미지 업로드와 이미지 없는 표지를 각각 확인합니다.
- 실제 한국 모바일 브라우저와 카카오톡 내부 브라우저에서 Google 로그인 복귀·쿠키, 날짜별 주소 새로고침, 오프라인 저장본과 날짜 표시를 확인합니다.
- 인쇄한 QR을 두 기종 이상에서 스캔해 실제 `/`로 연결되는지 확인합니다.

## 5. 응답 시간·오류·사용량

운영 Worker에는 Workers Logs와 소스맵 업로드가 켜진 설정이 생성됩니다. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)에서 요청 상태와 예외를 확인합니다. `/v1/health`는 DB 쿼리까지 확인하므로 모니터링 주소로 사용할 수 있습니다.

아래 명령은 헬스 체크 후 현재 주보 API를 지정 횟수만큼 요청하고 상태 코드, p50·p95·최대 응답 시간을 표시합니다. 기본은 100회·동시 5개이며 최대 1,000회·동시 20개로 제한됩니다. 공개 배포 후 낮은 동시성부터 올리며 실행합니다.

```sh
npm run check:api -- https://api.<도메인> 100 5
```

주일 접속 시간대에는 Workers 요청 수·오류율·응답 시간, Hyperdrive 연결 오류, DB CPU·연결 수·백업 상태, R2 저장량·요청 수를 확인합니다. 목표 수치는 실제 배포 직후 기준 측정값을 기록한 뒤 정합니다. 오류가 발생하면 먼저 `/v1/health`와 Workers Logs를 확인하고 DB 연결·비밀값·바인딩을 점검합니다.

## 6. 대표 이미지 정책

현재 API는 JPG·PNG·WebP만 허용하고 원본 5MB, 너비 2400px, 높이 4000px 이하로 검사합니다. 업로드 시 대체 텍스트가 필수이며 파일은 고유 키로 R2에 저장됩니다. 서버가 이미지를 자동 축소하지 않으므로 큰 원본은 관리자가 업로드 전에 줄여야 합니다. 정책을 바꾸면 API 검사와 관리자 화면 안내를 함께 수정합니다.
