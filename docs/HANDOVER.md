# HANDOVER

새 세션에서 이 프로젝트 개발을 이어가기 위한 인수인계 문서.
코드와 커밋이 기준이며, 이 문서는 현재 상태·규칙·함정을 요약한다.

먼저 읽을 것: `CLAUDE.md`, `MVP_요구사항_명세서.md`, `MVP_개발명세서.md`, `MVP_backlog.md`, 그리고 `git log --oneline -10`.

---

## 1. 제품 현황 (동작하는 것)

Google Forms 응답을 Google Sheets에서 가져와 검색하고, 현장 운영 상태(카테고리·입장·상품 수령)를 관리하며, 같은 Spreadsheet의 `운영 상태` 탭에 단방향으로 기록하는 내부 도구.

### 구현 완료

| 기능 | 내용 | 주요 파일 |
|---|---|---|
| 워크스페이스(파티) | 사용자별 소유, 사용자당 여러 소속 가능, 현재 워크스페이스 저장·전환 | `web/src/lib/workspace.ts`, `web/src/app/workspace-switcher.tsx` |
| 역할 | OWNER(설정·초대·동기화) / OPERATOR(조회·상태 변경) | `web/src/lib/workspace.ts` |
| 초대 | 이메일 초대, 로그인 허용 판정, 로그인 시 멤버십 수락(멱등), 취소 | `web/src/lib/invites.ts`, `web/src/app/settings/invite-manager.tsx` |
| 멤버 관리 | 목록, 제거(소속·초대·현재 워크스페이스 정리) | `web/src/lib/workspace-members.ts`, `web/src/app/settings/member-manager.tsx` |
| 인증 | Auth.js v5 JWT 세션(7일), Google OAuth, 환경 허용 목록 + 초대 경로 | `web/src/auth.ts`, `web/src/lib/allowed-emails.ts` |
| Sheets 연결 | URL/ID·탭 이름 저장, 권한·탭 검증, 워크스페이스당 설정 1행 | `web/src/lib/source-settings.ts` |
| 컬럼 매핑 | 헤더 자동 인식(별칭), 직접 지정, 지정값이 없으면 저장 거부, 불일치 시 동기화 중단 | `web/src/lib/column-mapping.ts` |
| 내부 ID | 서버가 동기화 시 `_internal_response_id` 컬럼 생성·기록 (Apps Script 제거됨) | `web/src/lib/response-id.ts`, `response-id-writer.ts`, `response-sync-run.ts` |
| 응답 동기화 | 헤더/행 읽기 → ID 보완 → DB upsert, 워크스페이스 단위 advisory lock, 소유자 전용 | `web/src/app/api/sync/responses/route.ts`, `response-sync-run.ts` |
| 검색·상세 | 이름(전체/부분/성 제외)·전화번호(정규화/뒷자리), 상태 필터 AND, 상세 조회 | `web/src/lib/responses.ts`, `web/src/app/search-client.tsx`, `web/src/app/responses/[id]/page.tsx` |
| 운영 상태 동기화 | 상태 변경 시 DB 저장 후 `after()`로 응답 전송 뒤 Sheet 반영, 상태/오류 기록·재시도 | `web/src/lib/operating-status.ts`, `web/src/app/api/responses/[id]/route.ts` |
| 중복 행 정리 | 중복 ID 탐지·병합·삭제, 중복 감지 시 동기화 중단 | `web/src/lib/duplicate-rows.ts`, `operating-status-duplicates.ts` |

- 테스트: `web/src/lib/*.test.ts` 16개 파일, 157개 테스트 통과.
- 운영: Vercel 프로젝트 `GFArtist`, `https://gf-artist.vercel.app`, 함수 리전 `sin1`(싱가포르, `web/vercel.json`), DB는 Neon(ap-southeast-1).

---

## 2. 데이터 모델 요약 (Prisma)

`web/prisma/schema.prisma` 기준.

- `User` — `currentWorkspaceId` 로 현재 워크스페이스 저장
- `Workspace` — `ownerUserId`, 멤버·초대·설정 관계
- `WorkspaceMember` — `(workspaceId, userId)` unique, `role` OWNER/OPERATOR
- `AccessInvite` — `(workspaceId, email)` unique, `status` INVITED/ACTIVE/REVOKED, `acceptedAt`
- `SourceSettings` — `workspaceId` unique, 탭 이름, 컬럼 매핑 5개, `lastResponseSyncAt`
- `Response` — `internalResponseId` unique, 카테고리·입장·상품, `statusSyncState`, `lastStatusSyncError`
- `SyncRun` — 응답 동기화 결과(건수·오류)
- `Category` — 전역 3종(입금 안 함/입금 확인/문자 발송 완료)

마이그레이션 6개(순서대로): `init`, `add_categories`, `add_workspaces`, `drop_apps_script_settings`, `add_current_workspace`, `add_access_invites`.

---

## 3. 환경

```text
로컬 앱            web/.env            DATABASE_URL=localhost:5432/sejin_dev
테스트             web/.env.test       DATABASE_URL=localhost:5432/sejin_test  (test-env.ts 가 강제)
운영 앱            Vercel 환경변수      DATABASE_URL=Neon (pooled/direct)
운영 DB 마이그레이션 Neon direct URL     이 PC 에 자격증명 없음 → 사용자가 직접 실행
```

Docker(로컬 DB):

```powershell
docker compose up -d                  # 컨테이너 sejin-postgres
docker inspect --format "{{.State.Health.Status}}" sejin-postgres
```

Prisma 설정 파일은 `web/prisma7.config.ts` (dotenv 로드). CLI 명령은 반드시 `web` 에서 실행.

---

## 4. 작업 규칙 (필수)

1. **스키마 변경은 마이그레이션 먼저 → 운영 적용 → 배포.**
   컬럼 추가형 변경을 마이그레이션 없이 배포하면 운영에서 전면 500이 발생한다(E-1에서 실제 발생).
   컬럼 삭제형은 여분 컬럼이 무해하므로 배포 후 적용 가능.
   운영 DB 자격증명이 없으므로 운영 마이그레이션은 사용자에게 요청하고 결과를 확인한 뒤 푸시한다.
2. **단계마다 검증 4종을 통과한 뒤 커밋·푸시**한다: `lint`, `tsc`, `test`, `build`.
3. **배포 확인은 build id 변화로 판정**한다(아래 5번).
4. 사용자가 직접 해야 하는 작업은 명시적으로 분리해 안내한다(운영 마이그레이션, Vercel 환경변수, Google Cloud 설정).
5. 스키마 의존 배포 전에 `npx prisma migrate status` 로 대상 호스트와 미적용 목록을 항상 확인한다.
6. 커밋은 단계별로 작게, 메시지는 Conventional Commits(영문).

---

## 5. 검증·배포 확인 명령 (web 디렉터리)

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
```

테스트가 대량으로 실패하면 먼저 Docker 데몬 정지를 의심하고 `docker compose up -d` 를 실행한다.

배포 확인(로그인 페이지의 build id 변화 폴링):

```powershell
$tmp = Join-Path $env:TEMP 'login.html'
function Get-BuildId {
  curl.exe -s -o $tmp --max-time 25 "https://gf-artist.vercel.app/login" 2>$null
  $t = Get-Content -Raw $tmp
  if ($t -match '\\"b\\":\\"([^"\\]+)') { return $Matches[1] }
  return ''
}
$before = Get-BuildId; Write-Output "before: $before"
for ($i=1; $i -le 20; $i++) {
  Start-Sleep -Seconds 20
  $after = Get-BuildId; Write-Output "[$i] $after"
  if ($after -and $after -ne $before) { Write-Output 'NEW_DEPLOY_LIVE'; break }
}
```

무인증 점검(정상 기준): `/` → 307, `/settings` → 307, `POST /api/sync/responses` → 401.

운영 DB 마이그레이션(사용자 실행, 붙여넣기 오류 방지용):

```powershell
cd C:\Users\Lenovo\Desktop\sejin\web
$secure = Read-Host 'Neon direct URL (main 브랜치, 비밀번호 포함)' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $secure).Password
if ($env:DATABASE_URL -notmatch 'neon\.tech') { Write-Host '중단: neon 주소 아님' -ForegroundColor Red }
elseif ($env:DATABASE_URL -match 'pooler') { Write-Host '중단: pooler 주소' -ForegroundColor Red }
else { npx prisma migrate status; npx prisma migrate deploy; npx prisma migrate status }
Remove-Item Env:\DATABASE_URL
```

---

## 6. 남은 작업과 우선순위

평가 결과(필요성·우선순위):

| 순위 | 작업 | 성격 | 비고 |
|---|---|---|---|
| 1 | Google OAuth 게시 상태 확인·전환 | 수동·외부 | 테스트 상태면 초대 계정도 Google 테스트 사용자여야 로그인 가능, refresh token 7일 만료. 상태 확인만 5분 |
| ~~2~~ | ~~운영 상태 Sheet writer 실제 테스트~~ | 완료 | `writeOperatingStatus` 로 분리하고 `OperatingStatusSheetsClient` 주입 추가, 가짜 클라이언트로 6개 테스트 추가(`operating-status.test.ts`) |
| 3 | 모바일·접근성 점검 | 수동+소소한 코드 | 현장에서 휴대폰 사용. 검색 폼·상태 버튼·설정 카드·전환 드롭다운 |
| 4 | Google 연동 자동 테스트 | 자동 | 우선순위 낮음(자격증명·CI 부재, 수동 스모크로 검증됨) |
| - | `GOOGLE_ALLOWED_EMAILS` DB 전환 | - | 하지 않는 것 권장(초대가 이미 대체 경로, 부트스트랩 잠금 위험) |

문서도 기능 추가 시 함께 갱신한다: 요구사항/개발명세/backlog.

---

## 7. 알려진 함정

- **컬럼 추가 마이그레이션 누락 시 전면 500.** React #441(서버 컴포넌트 렌더 오류)로만 보여 원인 파악이 어렵다. `migrate status` 로 먼저 확인.
- **운영 마이그레이션이 로컬에 적용되는 실수.** `DATABASE_URL` 미설정 또는 마스킹된 비밀번호(`******`)로 실행하면 `localhost:5432` 로 붙는다. 항상 `Datasource` 줄의 호스트를 확인.
- **Neon 브랜치 혼동.** 콘솔에서 백업 브랜치가 선택된 상태로 URL을 복사하면 엉뚱한 브랜치에 적용된다. main 브랜치 선택을 확인.
- **Docker Desktop 데몬이 자주 꺼진다.** 테스트가 갑자기 대량 실패하면 이것부터 확인.
- **Google OAuth 테스트 상태 제약.** 초대만으로 로그인이 보장되지 않는다. 앱 로그인 판정(`invites.ts`)과 Google 단계는 별개.
- **`SourceSettings.isActive` 는 제거됨.** 활성 파티 개념은 "현재 워크스페이스"로 대체.
- **Apps Script 통합은 제거됨.** `apps-script/` 디렉터리, `GOOGLE_APPS_SCRIPT_*`, `APP_ENCRYPTION_KEY` 모두 삭제. 관련 코드를 다시 참조하지 말 것.
- 로그인 페이지는 엣지 캐시되므로 배포 확인 시 이전과 다른 build id 를 기준으로 판단한다(배포가 먼저 끝나 `before` 값이 이미 신규일 수 있음 → 직전에 기록한 id 와 비교).

---

## 8. 주요 파일 지도

```text
web/src/auth.ts                              인증·세션·초대 수락
web/src/lib/workspace.ts                     워크스페이스 컨텍스트·멤버십·전환
web/src/lib/workspace-members.ts             멤버 목록·제거
web/src/lib/invites.ts                       초대 생성·취소·수락·허용 판정
web/src/lib/source-settings.ts               설정 저장·조회·캐시·탭 검증
web/src/lib/column-mapping.ts                헤더 자동 인식·검증
web/src/lib/response-id.ts                   ID 계획(순수 함수)
web/src/lib/response-id-writer.ts            시트에 ID 기록(클라이언트 주입)
web/src/lib/response-sync.ts                 DB upsert(트랜잭션 핸들 주입 가능)
web/src/lib/response-sync-run.ts             동기화 오케스트레이션·권한·lock
web/src/lib/operating-status.ts              운영 상태 Sheet writer·재시도·이상 감지
web/src/lib/responses.ts                     검색 쿼리
web/src/app/api/**                           API 라우트
web/src/app/settings/**                      설정 화면 카드들
web/prisma/schema.prisma                     데이터 모델
```

---

## 9. 사용자 확인이 필요한 항목 (이 시점 기준)

```text
1  Google Cloud OAuth 동의 화면 게시 상태 (테스트 / 프로덕션(미검증) / Internal)
2  외부(비테스트 사용자) 계정을 실제로 받을 계획 여부 → OAuth 작업 우선순위 결정
3  행사 운영을 휴대폰으로 하는지 → 모바일 점검 우선순위 결정
```
