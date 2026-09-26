import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GF Artist 개인정보처리방침',
  description: 'GF Artist가 Google 데이터를 수집·사용·보관하는 방법',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <article className="mx-auto max-w-2xl text-sm leading-7 text-slate-300">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
          Response Desk
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">개인정보처리방침</h1>
        <p className="mt-4 text-xs text-slate-500">최종 갱신: 2026년 9월</p>

        <p className="mt-8">
          GF Artist(이하 &ldquo;본 도구&rdquo;)는 행사·파티 운영팀이 참석자 응답을 관리할 수
          있도록 Google 계정과 Google Sheets 데이터를 사용합니다. 본 방침은 어떤 정보를
          어떻게 수집·사용·보관·공유하는지 설명합니다.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">1. 수집하는 정보</h2>
        <ul className="mt-3 space-y-2">
          <li>- Google 로그인 시 제공되는 계정 정보: 이름, 이메일 주소, 프로필 식별자.</li>
          <li>
            - 연결한 Spreadsheet의 응답 데이터: 참석자 이름, 전화번호, 성별, 주문 상품 등
            응답 항목과 입장·상품 수령 운영 상태.
          </li>
          <li>- 서비스 운영을 위한 OAuth 접근·갱신 토큰.</li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-white">2. 정보의 사용 목적</h2>
        <ul className="mt-3 space-y-2">
          <li>- 참석자 응답을 검색하고 현장 운영 상태를 기록하기 위해서만 사용합니다.</li>
          <li>- 변경된 운영 상태를 원본 Spreadsheet의 운영 상태 탭에 반영합니다.</li>
          <li>- 광고, 프로파일링, 또는 인공지능 모델 학습에 사용하지 않습니다.</li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-white">3. Google API 데이터 사용</h2>
        <p className="mt-3">
          본 도구가 Google API로부터 받은 정보의 사용은 Google API Services User Data
          Policy(제한적 사용 요구사항 포함)를 준수합니다. Google 계정 데이터는 위에 명시한
          기능 제공 목적 외에는 사용·전송되지 않습니다.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">4. 보관과 보안</h2>
        <ul className="mt-3 space-y-2">
          <li>- 데이터는 본 도구의 서버와 데이터베이스에 저장되며 접근이 제한됩니다.</li>
          <li>- 비밀 정보는 환경 변수로 관리하고 저장소에 남기지 않습니다.</li>
          <li>- 목적이 끝나거나 삭제를 요청하면 관련 데이터를 삭제합니다.</li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-white">5. 제3자 제공</h2>
        <p className="mt-3">
          수집한 정보를 판매하거나 제3자에게 제공하지 않습니다. 다만 Google API 사용에
          필요한 범위에서 Google 서비스와 통신합니다.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">6. 이용자의 권리</h2>
        <p className="mt-3">
          본인의 데이터 열람·정정·삭제를 요청할 수 있습니다. Google 계정 설정에서 본 도구의
          접근 권한을 언제든지 해제할 수 있습니다.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">7. 문의</h2>
        <p className="mt-3">
          본 방침에 대한 문의는{' '}
          <a className="text-emerald-300 hover:text-emerald-200" href="mailto:jun20082@gmail.com">
            jun20082@gmail.com
          </a>
          으로 보내주세요.
        </p>
      </article>
    </main>
  );
}
