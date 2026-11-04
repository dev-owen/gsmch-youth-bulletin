# 운영 배포와 점검

이 문서는 별도 도메인·Pages를 사용하는 배포 절차입니다. 현재 계정의 무료 Workers 주소와 Neon Free 구성은 [무료 배포 안내](free-deployment.md)를 따릅니다. 별도 도메인의 설정 값이 미정인 상태에서 그 주소로 공개 배포를 진행하지 않습니다.

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

기존 운영 DB에는 새 기능의 컬럼만 다음 마이그레이션으로 적용합니다.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20261105-church-events.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20261105-community-news-details.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20261105-promotion-link-label.sql
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
- 실제 iPhone Safari에서 설정·제어 센터의 텍스트 크기를 바꾸고 주보를 다시 열어 Dynamic Type 반영을 확인합니다. Android에서는 시스템 글자 크기 설정과 Chrome 접근성의 확대 설정을 각각 확인합니다. 시스템 설정 연동은 브라우저 버전에 따라 다르며, 지원하지 않는 브라우저에서는 브라우저 확대 기능을 사용합니다.
- 작은 글자부터 200% 및 기기의 최대 글자 크기까지 현재·지난 주보와 관리자 미리보기를 확인합니다. 제목·내용·계좌번호·달력·입력란이 잘리거나 서로 겹치지 않아야 하며, 두 손가락 확대도 가능해야 합니다.
- 인쇄한 QR을 두 기종 이상에서 스캔해 실제 `/`로 연결되는지 확인합니다.

## 5. 응답 시간·오류·사용량

운영 Worker에는 Workers Logs와 소스맵 업로드가 켜진 설정이 생성됩니다. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)에서 요청 상태와 예외를 확인합니다. `/v1/health`는 DB 쿼리까지 확인하므로 모니터링 주소로 사용할 수 있습니다.

아래 명령은 헬스 체크 후 현재 주보 API를 지정 횟수만큼 요청하고 상태 코드, p50·p95·최대 응답 시간을 표시합니다. 기본은 100회·동시 5개이며 최대 1,000회·동시 20개로 제한됩니다. 공개 배포 후 낮은 동시성부터 올리며 실행합니다.

```sh
npm run check:api -- https://api.<도메인> 100 5
```

주일 접속 시간대에는 Workers 요청 수·오류율·응답 시간, Hyperdrive 연결 오류, DB CPU·연결 수·백업 상태, R2 저장량·요청 수를 확인합니다. 목표 수치는 실제 배포 직후 기준 측정값을 기록한 뒤 정합니다. 오류가 발생하면 먼저 `/v1/health`와 Workers Logs를 확인하고 DB 연결·비밀값·바인딩을 점검합니다.

## 6. 대표 이미지 정책

관리자 화면에서 JPG·PNG·WebP 원본(최대 20MB, 5천만 화소)을 선택하면 브라우저가 비율을 유지해 긴 변 최대 1,920px, 512KB 이하로 자동 압축합니다. WebP를 우선 사용하고 인코딩을 지원하지 않는 브라우저에서는 JPEG로 변환하며 투명 영역은 흰색으로 채웁니다. 압축에 실패하면 업로드하지 않습니다.

업로드 시 대체 텍스트가 필수이며 R2에는 최적화한 파일만 고유 키로 저장됩니다. API도 파일 형식·512KB 용량·긴 변 1,920px 제한을 검사합니다. 기존 이미지는 다시 업로드해야 최적화가 적용됩니다. 정책을 바꾸면 API 검사와 관리자 화면 안내를 함께 수정합니다.

## 7. 휴대폰 글자 크기 지원

`<meta name="text-scale" content="scale">`로 지원 브라우저의 시스템·브라우저 글자 크기를 반영하고, Safari에서는 `font: -apple-system-body`로 Dynamic Type을 반영합니다. 글자 크기는 `rem`을 사용하며 기본 루트 크기는 시스템 설정을 따릅니다. `env(preferred-text-scale)`을 함께 곱하면 배율이 중복 적용될 수 있으므로 사용하지 않습니다. 구현 근거는 [CSS Fonts의 text-scale 정의](https://www.w3.org/TR/css-fonts-5/#text-scale-meta)와 [WebKit 시스템 글꼴·Dynamic Type 안내](https://webkit.org/blog/3709/using-the-system-font-in-web-content/)입니다.

상단의 읽기 설정에서 `− / +`로 80~200%를 10% 단위로 조절합니다. 100%는 기기의 기본 글자 크기이며, 수동 조절 시에도 별도의 `medium`/Dynamic Type 요소로 시스템 기본 크기를 측정해 그 배율을 적용합니다. 시스템 글자 크기 변경과 창 복귀 시 배율을 다시 계산합니다. 선택은 `gsmch-reading-text-size-v1` 로컬 저장소에 보관되며, 기본 크기로 되돌리면 저장 값을 제거합니다. 저장소를 사용할 수 없어도 현재 화면의 조절은 동작합니다. 현재·지난 주보에서 조절, 새로고침 후 유지, 기본 크기 복원, 최소·최대 버튼 비활성화, 설정 외부 터치·Escape로 닫기를 확인합니다.

웹/PWA에서는 휴대폰의 물리 볼륨 버튼을 글자 조절 버튼으로 안정적으로 사용할 수 없습니다. 홈 화면에 설치해도 이 제한은 같습니다. 이 기능에는 기기별 네이티브 입력 처리가 필요하며 현재 웹 구현에는 포함하지 않습니다.
