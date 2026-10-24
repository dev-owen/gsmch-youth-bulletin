# 선한목자 젊은이교회 모바일 주보 기술 설계 초안

작성일: 2026년 10월 25일  
프로젝트: `gsmch-youth-bulletin`  
기준: [모바일 주보 기획서](gsmch-youth-bulletin-plan.md)  
상태: 구현 전 검토용

## 1. 설계 결정

첫 버전은 **React + Vite 모바일 웹과 관리자 화면을 Cloudflare Pages에 배포**하고, **TypeScript + Hono 공통 API를 Cloudflare Workers에서 실행**한다. 데이터는 관리형 PostgreSQL에, 대표 이미지와 향후 홍보 미디어는 Cloudflare R2에 저장한다. 로그인은 Better Auth와 소셜 로그인 제공자 한 곳을 사용한다. 자체 SMTP는 두지 않는다.

공개 주소 `https://domain.com/`은 인쇄 QR에 넣고 매주 그대로 유지한다. 관리자가 발행하면 이 주소의 최신 주보만 바뀐다. 날짜별 주소로 지난 주보를 볼 수 있고, 관리자 기능은 `https://domain.com/admin/*`에서 제공한다. 향후 모바일 앱은 웹과 같은 `https://api.domain.com/v1/*` API를 사용한다.

이 구성은 현재의 적은 운영 인력과 하루 약 1,000회 방문을 기준으로 선택했다. API 주소와 데이터 계약을 유지하면 나중에 백엔드를 Nest.js로 교체할 수 있다. 다만 Hono 서버 코드를 Nest.js로 옮기는 개발 작업은 필요하다.

### 프런트엔드 선택

React + Vite의 단일 페이지 앱은 주보 발행 때 재배포하지 않고도 새 `/bulletins/YYYY-MM-DD` 주소를 처리할 수 있다. Cloudflare Pages는 정적 파일이 없는 경로에 앱 진입점을 제공하고, 클라이언트 라우터가 날짜를 해석한다. Next.js 정적 내보내기는 새 날짜의 동적 경로를 처리하려면 별도 빌드 또는 라우팅 장치가 필요하므로 첫 버전에서는 쓰지 않는다. 날짜별 검색 노출이나 카카오톡 공유 미리보기가 중요해지면 공개 화면에 HTML 사전 생성 또는 서버 렌더링을 추가한다. [Pages의 SPA 경로 동작](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Next.js 정적 배포 안내](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

## 2. 시스템 구성

```text
방문자 웹 ── domain.com ── Cloudflare Pages ──┐
관리자 웹 ── domain.com/admin/* ──────────────┼── api.domain.com ── Cloudflare Workers
향후 모바일 앱 ────────────────────────────────┘      TypeScript + Hono + Better Auth
                                                       │
                                                       ├── Hyperdrive ── 관리형 PostgreSQL
                                                       └── R2 바인딩 ── 미디어 버킷

공개 대표 이미지 ── media.domain.com ── Cloudflare 캐시 ── R2
```

| 역할 | 기술 | 운영상 의미 |
| --- | --- | --- |
| 공개·관리자 웹 | React, TypeScript, Vite, Cloudflare Pages | 코드가 바뀔 때만 배포 |
| 공통 API | TypeScript, Hono, Cloudflare Workers | 웹과 앱에서 같은 업무 규칙 사용 |
| 데이터 | 관리형 PostgreSQL | DB 서버·OS 운영 부담 감소 |
| DB 연결 | Cloudflare Hyperdrive + PostgreSQL 드라이버 | Workers의 분산 요청에 맞는 연결 풀 |
| 인증 | Better Auth, 소셜 로그인 | 관리자와 추후 일반 회원의 사용자 ID 공유 |
| 미디어 | Cloudflare R2 Standard | 파일은 저장소, 메타데이터만 DB에 저장 |
| 배포 | Git, Wrangler, Pages 빌드 | 웹과 API를 독립적으로 배포 |

Cloudflare Workers는 상시 실행 Node.js 서버와 실행 환경이 다르다. Hono는 Workers의 웹 표준 요청·응답 모델에 맞고, Better Auth는 Hono에 연결할 수 있다. PostgreSQL은 Hyperdrive를 거쳐 접속한다. 첫 버전은 Hyperdrive의 쿼리 캐시를 끄고 연결 풀만 사용해 발행 직후 주보와 세션·권한 변경을 즉시 읽는다. 첫 개발 단계에서 인증·DB 드라이버·R2 업로드가 실제 Workers 환경에서 작동하는지 검증한다. [Hono Workers 안내](https://hono.dev/docs/getting-started/cloudflare-workers), [Better Auth Hono 연동](https://better-auth.com/docs/integrations/hono), [Hyperdrive의 캐시 설정](https://developers.cloudflare.com/hyperdrive/reference/faq/).

DB의 첫 후보는 Render PostgreSQL의 유료 소형 인스턴스다. 무료 DB는 실험에만 사용하고 공개 운영 전에는 복구 기능이 있는 유료 DB로 옮긴다. Render 유료 PostgreSQL은 시점 복구를 제공하며 현재 Hobby 워크스페이스의 복구 가능 기간은 3일이다. 실제 제공자·지역·요금제는 배포 시점에 재확인한다. [Render 백업·복구](https://render.com/docs/postgresql-backups).

## 3. 프로토타입 기능

공개 화면은 **표지 → 예배 순서와 담당자 → 설교 → 홍보 카드 → 교회 안내 → 지난 주보** 순서다. 표지에는 예배 날짜·주제와 선택적 대표 이미지를 넣는다. 이미지가 없으면 텍스트 표지를 보여 준다. 설교에는 제목·성경 본문·설교자를 표시한다. 홍보 카드는 0~3개이며, 예시는 새가족 안내·소그룹 모임·봉사 참여다. 예배·모임 시간, 교회 소개, 비전, 오시는 길은 별도의 고정 정보로 관리한다.

관리자는 로그인 후 주보 목록·새 주보 작성·모바일 미리보기·발행, 교회 안내 편집을 할 수 있다. 새 주보에는 지난주 **예배 순서 항목 이름만** 복제하고 담당자·설교·홍보·표지는 새로 입력한다. 저장과 발행은 별도 버튼으로 둔다. 홍보 카드 링크가 없으면 공개 화면에서 버튼을 숨긴다.

교우 소식, 성경 통독표, 헌금 안내, PDF 생성, 알림 발송, 회원 행사 신청은 이번 프로토타입에 포함하지 않는다.

## 4. 주소와 API 계약

| 주소 | 동작 |
| --- | --- |
| `https://domain.com/` | 인쇄 QR의 고정 주소, 현재 주보 |
| `https://domain.com/archive` | 지난 주보 목록 |
| `https://domain.com/bulletins/2026-10-18` | 해당 날짜 발행본 |
| `https://domain.com/admin/*` | 관리자 로그인과 편집 화면 |
| `https://api.domain.com/v1/*` | 웹·앱 공통 업무 API |
| `https://api.domain.com/api/auth/*` | 로그인·로그아웃·OAuth 콜백 |
| `https://media.domain.com/*` | 공개 이미지 |

`domain.com`은 실제 소유 도메인이 정해지면 치환한다. API는 운영 웹 도메인만 CORS 허용 목록에 넣고, 웹은 자격 증명을 포함해 요청한다. 회원·관리자 응답에는 `Cache-Control: no-store`를 사용한다. 앱에는 브라우저의 CORS 정책이 적용되지 않지만 인증·권한 검사는 동일하다.

| API 예시 | 접근 권한 | 기능 |
| --- | --- | --- |
| `GET /v1/bulletins/current` | 공개 | 최신 주보와 교회 안내 |
| `GET /v1/bulletins?cursor=...` | 공개 | 발행본 목록 |
| `GET /v1/bulletins/{date}` | 공개 | 날짜별 발행본 |
| `GET /v1/admin/bulletins/{id}` | 관리자 | 초안 포함 편집 데이터 |
| `POST /v1/admin/bulletins` | 관리자 | 새 초안 생성 |
| `PUT /v1/admin/bulletins/{id}` | 관리자 | 주보 내용 저장 |
| `POST /v1/admin/bulletins/{id}/publish` | 관리자 | 최신 주보 전환 |
| `PUT /v1/admin/site-info` | 관리자 | 고정 교회 안내 저장 |
| `POST /v1/admin/media` | 관리자 | 이미지 검사와 업로드 |

날짜는 `YYYY-MM-DD`로, 시간이 필요한 값은 ISO 8601과 명시된 시간대(기본 `Asia/Seoul`)로 통일한다. 목록에는 페이지 크기 상한을 두고, 오류는 `code`, `message`를 가진 JSON으로 반환한다. 공개 주보 응답에는 회원 개인정보를 섞지 않는다. 모바일 앱 출시 후 `/v1` 필드의 의미를 호환성 없이 바꾸지 않는다.

## 5. 데이터 모델과 발행

| 테이블 | 주요 필드 | 규칙 |
| --- | --- | --- |
| `bulletins` | `id`, `service_date`, `theme`, `cover_media_id?`, `sermon_title`, `scripture`, `preacher`, `status`, `published_at` | 날짜 중복 금지. 초안 비공개 |
| `worship_items` | `id`, `bulletin_id`, `position`, `label`, `assignee` | 주보별 순서 보존 |
| `promotions` | `id`, `bulletin_id`, `position`, `title`, `body`, `url?` | 주보당 최대 3개를 서버에서 검사 |
| `site_info` | 단일 행, 예배·모임 시간, 소개, 비전, 주소, 지도 URL | 주보와 독립적으로 수정 |
| `site_settings` | 단일 행, `current_bulletin_id` | 현재 공개 주보 포인터 |
| `media_assets` | `id`, `object_key`, `content_type`, `size_bytes`, `alt_text` | 실제 파일은 R2에 저장 |
| 인증 테이블 | 사용자·계정·세션 | Better Auth의 스키마 사용 |
| `admin_users` | `user_id`, `granted_at` | 승인된 사용자 ID만 관리자 |

`bulletins.status`는 `draft` 또는 `published`다. 발행 API는 **한 DB 트랜잭션에서** 필수 항목을 검증하고 주보를 발행 상태로 바꾸며 `current_bulletin_id`를 갱신한다. 초안을 저장하거나 이미지를 올리는 동안 `/`은 기존 주보를 유지한다. 공개 주보가 전혀 없으면 교회명과 준비 중 안내를 표시한다.

발행본의 오탈자는 관리자 화면에서 고쳐 저장한다. 그 날짜별 주소의 내용도 갱신되지만 다른 주보의 최신 포인터는 바뀌지 않는다. 첫 버전에는 발행본 영구 삭제와 버전 되돌리기를 넣지 않는다. 교회 안내는 지난 주보 화면에도 **현재 값**을 표시한다. 발행 당시 안내를 보존해야 한다는 요구가 생기면 별도 버전 테이블을 추가한다.

## 6. 로그인과 권한

처음에는 관리자 로그인만 연다. Better Auth가 첫 OAuth 제공자와 통신하고 PostgreSQL에 사용자·세션을 저장한다. Google 또는 Kakao 중 운영자가 사용하는 한 곳으로 시작한다. Kakao 이메일 조회는 Biz App 자격이 필요하므로 해당 제공자를 선택하면 등록 가능 여부를 먼저 확인한다. 로그인이 곧 관리자 권한을 뜻하지 않도록 `admin_users.user_id`에 승인된 계정만 등록한다. 권한 부여·회수는 배포 관리자의 DB 관리 절차로 수행하고 대시보드의 자기 승격 기능은 만들지 않는다. [Better Auth Kakao 설정](https://better-auth.com/docs/authentication/kakao).

웹은 API 도메인의 `HttpOnly`, `Secure` 세션 쿠키를 사용한다. API는 초안 조회, 수정, 발행, 이미지 업로드 **모든 요청에서** 세션과 관리자 목록을 확인한다. 웹에서 관리자 메뉴를 숨기는 것은 편의 기능이며 보안 경계가 아니다. 실제 도메인과 카카오톡 내부 브라우저에서 OAuth 복귀·쿠키·허용 출처를 검증한다.

향후 일반 사용자 계정을 열어도 같은 인증 DB와 사용자 ID를 쓴다. `admin_users`에 없는 로그인 사용자는 일반 사용자다. 주보는 로그인 전후 동일하게 공개된다. Better Auth는 Expo 앱 연동도 제공하므로 React Native/Expo를 선택하면 같은 인증 백엔드를 쓸 수 있다. 앱 세션은 기기의 보안 저장소에 보관한다. [Better Auth Hono 연동](https://better-auth.com/docs/integrations/hono), [Expo 연동](https://better-auth.com/docs/integrations/expo).

처음에는 이메일·비밀번호 로그인과 자체 SMTP를 만들지 않는다. 나중에 이메일 알림이나 비밀번호 재설정이 필요한 기능을 추가할 때 발송 서비스를 별도 결정한다.

## 7. 이미지와 영상

대표 이미지는 선택 사항이다. 초기에는 JPG·PNG·WebP만 허용하고 예를 들어 원본 5MB 이하, 출력 폭 상한을 둔다. 확장자뿐 아니라 실제 파일 형식도 확인한다. R2에는 고유한 객체 키로 저장해 이미지를 교체해도 이전 주보의 파일을 덮어쓰지 않는다. DB에는 파일 키·형식·크기·대체 텍스트를 기록한다.

공개 이미지 전용 버킷을 `media.domain.com`에 연결해 Cloudflare 캐시로 제공한다. 회원 개인정보나 비공개 자료는 이 도메인에 저장하지 않는다. 영상이 추가되면 대용량 파일을 API 서버를 거치지 않고 제한된 업로드 권한으로 R2에 직접 보내는 방식을 검토한다. R2 자체는 파일 저장소이므로 화질별 변환, 적응형 스트리밍, 자막은 별도 서비스가 필요하다. 첫 단계의 영상 홍보는 외부 영상 링크가 가장 단순하다. [R2 공개 버킷과 캐시](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## 8. 속도와 오프라인 PWA

웹 앱 파일과 공개 이미지는 Cloudflare 캐시로 제공한다. 주보 API는 화면에 필요한 작은 JSON을 한 번에 반환하고 DB 조회 수를 제한한다. 주일 특정 시간대의 접속 집중은 별도로 시험한다. DB 제공 지역은 주요 이용자가 있는 한국과의 지연 시간을 보고 고르고 Hyperdrive로 연결한다. 발행 직후 최신 주보가 늦게 바뀌지 않도록 `GET /v1/bulletins/current`는 처음에는 DB에서 바로 읽는다. 공개 API 캐시는 실제 지연을 측정한 뒤 추가한다.

PWA는 앱 파일과 **온라인에서 마지막으로 성공적으로 연 최신 주보 한 건**을 저장한다. 온라인에서는 새 주보를 먼저 요청하고 통신 실패 시 저장본을 보여 준다. 오프라인 화면에 주보 날짜와 `오프라인 저장본` 표시를 넣는다. 처음 방문부터 오프라인이면 저장본 없음 안내를 표시한다. 대표 이미지가 있으면 함께 저장하고 없으면 텍스트 표지를 쓴다. 관리자 화면, 세션, 개인 신청 내역, 영상은 오프라인 캐시에 넣지 않는다. 오프라인에서는 발행·수정·행사 신청을 처리하지 않는다.

정적 웹은 처음에 HTML, JavaScript, API 응답을 차례로 받아야 한다. 목표 로딩 속도에 못 미치면 이미지·스크립트 크기, API 응답 시간, DB 위치를 측정한 뒤 개선한다. 날짜별 SNS 공유 카드가 중요해지면 공개 경로에 HTML 사전 생성 또는 서버 렌더링을 추가한다.

## 9. 향후 행사 신청과 앱

행사 기능을 열 때 `events`, `event_registrations`, 선택적 `profiles` 테이블을 추가한다. 홍보 카드에는 선택적 `event_id`를 연결해 같은 행사를 여러 주보와 앱에서 재사용한다.

| 후속 API | 기능 |
| --- | --- |
| `GET /v1/events/{id}` | 공개 행사 일정·마감·정원·수집 정보 |
| `POST /v1/events/{id}/registrations` | 로그인 사용자 신청 |
| `GET /v1/me/registrations` | 본인 신청 목록 |
| `GET /v1/admin/events/{id}/registrations` | 관리자 신청 목록 |

방문자가 **신청하기를 명시적으로 누른 경우에만** 로그인 복귀 후 해당 행사 한 건을 자동 신청한다. 일반 로그인이나 주보 조회만으로 신청하지 않는다. 신청 API는 클라이언트가 보낸 사용자 ID를 믿지 않고 세션에서 식별한다. DB에는 `UNIQUE(event_id, user_id)`를 두고 접수 기간·정원 확인과 신청 생성을 트랜잭션으로 처리한다. 정원 제한이 있으면 행사 행을 잠가 동시 신청에서도 정원을 넘기지 않는다. 추가 질문·동의·결제가 필요한 행사는 로그인 후 확인 화면을 거친다.

앱은 웹과 같은 API와 계정 ID를 사용한다. 웹에서 신청한 내용은 앱의 내 신청에도 표시된다. 앱 출시 뒤 오래된 버전이 남을 수 있으므로 `/v1` 계약을 유지하고 호환되지 않는 변경은 새 버전 경로로 분리한다. 앱의 오프라인 주보 저장은 앱 자체 저장소로 구현하며 신청은 온라인에서만 처리한다.

## 10. 비용과 운영

현재 공개 가격을 기준으로 한 출발점은 다음과 같다. 실제 청구액은 도메인, DB 요금제·저장량, 영상 사용량, 세금과 결제 환율에 따라 달라진다.

| 항목 | 월 비용 기준 |
| --- | --- |
| Cloudflare Pages 정적 웹 | 무료 구간에서 시작 |
| Cloudflare Workers Paid | 계정당 기본 $5. 포함량 초과 시 추가 과금 |
| 관리형 PostgreSQL | Render 소형 유료 인스턴스 약 $6부터. 성능 부족 시 상위 요금제 |
| Hyperdrive | Workers Paid에 포함 |
| R2 Standard | 월평균 저장 10GB, 쓰기 100만 건, 읽기 1,000만 건까지 무료 구간 |
| 자체 도메인 | 등록·갱신비 별도 |

**작은 유료 DB + Workers Paid + R2 무료 범위라면 월 약 $11부터** 시작한다. 이는 성능이나 청구액의 보장이 아니다. 영상 파일을 직접 제공하면 R2 저장량·작업 수와 시청자의 데이터 사용량을 계산한다. 모바일 앱을 추가해도 API 서버를 하나 더 배포할 필요는 없다. [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/), [Hyperdrive 요금](https://developers.cloudflare.com/hyperdrive/platform/pricing/), [R2 요금](https://developers.cloudflare.com/r2/pricing/), [Render DB 요금제](https://render.com/docs/compute-plans).

운영자가 매주 하는 일은 **새 초안 만들기 → 변경 항목 입력 → 모바일 미리보기 → 발행**이다. 서비스 관리자는 DB 백업 상태, 발행 오류, API 오류율과 미디어 사용량을 정기 확인한다. 유료 관리형 DB의 시점 복구를 사용하되 행사 신청 등 개인정보가 생기기 전에는 장기 보관용 논리 백업과 복원 시험 방법을 확정한다. 배포 비밀값은 Git에 넣지 않고 Cloudflare 비밀값으로 관리한다.

## 11. 구현 순서와 검증

1. Pages 웹, Workers API, PostgreSQL·Hyperdrive, R2 연결을 준비한다. 로그인과 DB 연결을 실제 Workers 환경에서 먼저 시험한다.
2. 공개 주보·지난 주보·교회 안내 API와 모바일 화면을 만든다.
3. 관리자 로그인, 초안 편집, 이미지 업로드, 발행 트랜잭션을 만든다.
4. PWA 저장과 실제 도메인·고정 QR 경로를 연결한다.
5. 한국 모바일 기기와 카카오톡 내부 브라우저에서 로그인·발행·오프라인·접속 집중을 검증한다.

| 시험 상황 | 기대 결과 |
| --- | --- |
| 초안 저장 중 QR 접속 | 기존 발행 주보 유지 |
| 새 주보 발행 후 같은 QR 접속 | 새 주보 표시, 웹 재배포 불필요 |
| 이미지 없는 주보 | 텍스트 표지 표시 |
| 지난 날짜 주소 직접 접속·새로고침 | 해당 발행본 표시 |
| 온라인에서 열고 오프라인 재접속 | 저장본과 날짜 표시 |
| 비로그인 또는 일반 사용자 관리 API 요청 | 초안 조회·수정·발행·업로드 거부 |
| 홍보 4개 또는 잘못된 입력 | 검증 오류, 발행되지 않음 |
| 발행 요청 중복 | 현재 주보 포인터와 상태가 일관되게 유지 |

## 12. Nest.js 전환 기준과 미정 사항

Hono로 현재 주보·회원·행사 API를 구현할 수 있다. 향후 **행사별 다단계 승인, 세밀한 관리자 권한, 여러 외부 시스템 연동, 지속 실행 작업과 작업 큐**가 핵심 기능으로 확정되거나 백엔드 담당자가 늘어 모듈 경계 관리가 어려워지면 Nest.js 전환을 검토한다. Nest.js는 모듈·서비스 주입·작업 큐 구조를 제공한다. 전환 시 API를 상시 Node.js 서버에 배포하고 Pages·R2·PostgreSQL은 유지할 수 있다. Nest.js를 Workers에서 그대로 운영하는 방식은 Node.js 호환성과 시작 시간을 따로 검증해야 하므로 기본 전환안으로 두지 않는다. [Nest.js 모듈](https://docs.nestjs.com/modules), [Nest.js 작업 큐](https://docs.nestjs.com/techniques/queues), [Workers Node.js 호환성](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).

구현 전에는 실제 도메인과 DNS 관리 권한, 첫 관리자 로그인 제공자, 예배·모임 시간, 교회 소개·비전, 주소·지도 링크, 대표 이미지 규격을 확정한다. 행사 신청을 열기 전에는 첫 행사의 개인정보 수집·동의, 취소와 대기자 규칙을 결정한다. 영상 직접 제공과 날짜별 SNS 공유 미리보기는 실제 필요가 확인될 때 설계한다.
