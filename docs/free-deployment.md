# 무료 구성 배포와 복구

2026-10-25에 확인한 구성입니다. 공개 웹·API·이미지는 **하나의 Workers 주소** `https://gsmch-youth-bulletin.gsmch-youth-dev.workers.dev`를 사용합니다. Worker 정적 자산이 React 화면을 제공하고 `/api/*`, `/v1/*`는 Hono API로 전달합니다. 이미지는 기존 R2 버킷의 객체를 `/v1/media/:key`에서 읽습니다. Pages 프로젝트, 별도 DNS, R2 공개 도메인은 이 구성에 필요하지 않습니다. 주소가 실제로 배포되기 전에는 QR을 만들지 않습니다.

## 준비된 자원

- Cloudflare R2 버킷: `gsmch-youth-bulletin-media`. 별도의 공개 버킷 URL은 사용하지 않습니다.
- Cloudflare Hyperdrive: `a8b2a5b323bb47df9b697d00dae78005`. Neon의 **직접 연결 주소**를 사용하며 쿼리 캐시는 비활성화했습니다.
- Neon Free 프로젝트: `gsmch-youth-bulletin` (`flat-rice-20036914`), 기본 브랜치 `production`. Better Auth의 `user`, `session`, `account`, `verification` 테이블과 `apps/api/db/schema.sql`의 서비스 테이블을 적용했습니다.
- Neon 시점 복구: 2026-10-25 03:12 KST 시점에서 `restore-check-20261025` 브랜치를 만들어 11개 테이블 및 `site_info`, `site_settings`의 기본 행을 확인했습니다. 검증 브랜치는 2026-10-26 03:13 KST에 자동 삭제되도록 설정했습니다. 운영 브랜치에는 복원 내용을 덮어쓰지 않았습니다.

Neon Free는 [프로젝트당 1GB, 월 100 CU-hours, 6시간 복구 범위](https://neon.com/blog/neon-free-plan-1-gb-per-project)를 제공합니다. 한도에 닿으면 서비스가 멈출 수 있습니다. Workers Free에는 [일 10만 Worker 요청과 요청당 10ms CPU 제한](https://developers.cloudflare.com/workers/platform/limits/)이 있습니다. 정적 자산 요청은 [Workers Free에서 무료](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)입니다. Hyperdrive와 Neon의 연결이 실제 사용량과 scale-to-zero에 미치는 영향은 공개 후 Neon Usage에서 확인해야 합니다.

## 설정 생성과 배포

```sh
cp deployment/config.free.example.json deployment/config.free.local.json
npm run prepare:free
npm run build:free
```

`prepare:free`는 `apps/api/wrangler.free.jsonc`를 생성합니다. 위 두 로컬 파일은 Git에서 제외됩니다. 생성 설정의 `WEB_ORIGIN`과 `BETTER_AUTH_URL`은 같은 Workers 주소이고, `PUBLIC_MEDIA_BASE_URL`은 그 주소의 `/v1/media`입니다. 웹 빌드에는 `VITE_API_BASE_URL`과 `VITE_MEDIA_BASE_URL`을 빈 값으로 지정하므로 브라우저 요청이 같은 출처로 갑니다. `.assetsignore`는 Pages 전용 `_redirects`를 Worker 정적 자산에서 제외합니다.

공개 배포 전 다음 세 비밀값을 준비합니다. `BETTER_AUTH_SECRET`은 32자 이상 난수로 생성합니다. Google OAuth 앱의 승인된 리디렉션 URI는 `https://gsmch-youth-bulletin.gsmch-youth-dev.workers.dev/api/auth/callback/google`입니다. Google 설정과 관리자 승인 작업은 별도 단계입니다.

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

비밀값을 Git에 저장하지 않고 `deployment/secrets.free.local.json`에 `{"BETTER_AUTH_SECRET":"...","GOOGLE_CLIENT_ID":"...","GOOGLE_CLIENT_SECRET":"..."}` 형식으로 작성하거나 Cloudflare Worker의 Secrets 설정으로 전달합니다. 이 파일도 Git에서 제외됩니다. 최초 배포에는 세 비밀값이 모두 필요합니다. 다음 명령은 웹을 다시 빌드하고 비밀값과 함께 Worker를 배포합니다.

```sh
npm run deploy:free -- --secrets-file ../../deployment/secrets.free.local.json
```

배포 후 `/`, `/v1/health`, `/v1/bulletins/current`를 확인하고 `npm run check:api -- https://gsmch-youth-bulletin.gsmch-youth-dev.workers.dev 100 5`로 초기 응답 시간을 기록합니다.

Google OAuth 앱과 첫 관리자 승인이 끝난 뒤 로그인 복귀, 발행 직후 갱신, 날짜별 직접 접속, 모바일 오프라인 재접속을 실제 기기에서 확인합니다. 교회 소개·모임 시간·주소는 공식 자료를 확인한 다음 관리자 화면에 입력합니다.

## 복구와 사용량

Neon **Branches → Create branch → Branch data and schema from a past point in time**에서 6시간 이내의 복구 시점을 선택하고, 자동 삭제가 있는 검증 브랜치를 만듭니다. 검증 브랜치에서 `site_info`, `site_settings`, 최근 `bulletins`, `admin_users`를 조회한 뒤 실제 운영 브랜치와 비교합니다. 운영 브랜치 덮어쓰기는 검증 결과를 확인한 다음에만 결정합니다. 6시간보다 오래된 데이터 손실에 대비하려면 별도 논리 백업을 안전한 저장소에 보관해야 합니다. 인증·세션 데이터가 포함되므로 공개 버킷에 두지 않습니다.

Neon Usage에서 저장량·CU-hours·복구 이력을, Cloudflare에서 Worker 요청·오류·CPU·Hyperdrive 쿼리·R2 사용량을 확인합니다. [Neon은 5분간 활동이 없으면 scale-to-zero](https://neon.com/docs/manage/endpoints/)할 수 있지만, 연결 요청이 계속되면 중지되지 않을 수 있습니다. 공개 후 실제 사용량을 보고 무료 한도 내에서 유지되는지 판단합니다.
