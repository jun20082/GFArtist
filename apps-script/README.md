# Apps Script 설정

이 스크립트는 원본 응답 Sheet의 시스템용 `_internal_response_id` 컬럼만 관리합니다.
응답자가 입력한 필드나 운영 상태 값은 기록하지 않습니다. 운영 상태 탭의 기록은 웹사이트 서버가 수행합니다.

## 최초 1회 설정

1. Google Form과 연결된 응답 스프레드시트를 엽니다.
2. `확장 프로그램 > Apps Script`를 엽니다.
3. Apps Script 프로젝트에 `Code.gs`와 `appsscript.json`을 추가합니다.
4. Script Properties에 `WEB_APP_SECRET`을 저장하고, 인자를 전달하는 임시 실행 함수로 `setupSourceSheet(spreadsheetId, responseSheetName, webAppSecret)`을 한 번 실행합니다. Apps Script 편집기의 실행 버튼은 함수 인자를 직접 전달하지 않습니다.
5. 요청된 Google 권한을 승인합니다.
6. 프로젝트를 Web App으로 배포합니다.
7. Web App URL과 동일한 Secret을 서버 환경변수에 설정합니다.

생성한 Secret은 비밀번호 관리자에 저장합니다. Secret을 Git에 커밋하거나 이 파일에 기록하지 않습니다.

## 자동 처리

- 기존 행은 `setupSourceSheet` 실행 또는 인증된 `ensure_ids` 요청 시 ID를 부여받습니다.
- 신규 Form 응답은 설치된 스프레드시트 제출 트리거를 통해 ID를 부여받습니다.
- 설정이 완료되면 `_internal_response_id` 컬럼이 보호됩니다.
- 이미 생성된 ID는 교체하지 않습니다.

## Web App 요청

서버는 다음 JSON POST 본문으로 배포된 Web App을 호출해 원본 응답 탭의 ID 누락을 보완합니다.

```json
{
  "action": "ensure_ids",
  "secret": "SET_IN_SERVER_ENVIRONMENT"
}
```

응답에는 `generatedCount`와 `totalResponseCount`가 포함됩니다.

## 원본 응답 컬럼

이 스크립트는 특정 응답자 컬럼 이름을 요구하지 않습니다. 이름·전화번호·성별·주문 상품에 해당하는
컬럼은 웹사이트의 `Sheets 설정` 화면에서 자동 인식되거나 직접 지정합니다.

`_internal_response_id` 컬럼은 이 스크립트가 추가하고 관리합니다.
