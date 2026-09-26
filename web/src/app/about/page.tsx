import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'GF Artist 소개',
  description: 'Google Forms 응답을 Sheets에서 검색하고 현장 운영 상태를 관리하는 도구',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <article className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
          Response Desk
        </p>
        <h1 className="mt-3 text-3xl font-semibold">GF Artist</h1>
        <p className="mt-6 text-sm leading-7 text-slate-300">
          GF Artist는 행사·파티 운영팀을 위한 내부 도구입니다. Google Forms로 수집된
          참석자 응답을 Google Sheets에서 불러와 이름과 전화번호로 검색하고, 입장 여부와
          상품 수령 여부 같은 현장 운영 상태를 기록합니다.
        </p>

        <h2 className="mt-10 text-xl font-semibold">주요 기능</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <li>- 연결한 Google Sheets의 응답을 서버로 동기화하고 검색합니다.</li>
          <li>- 입장·상품 수령 상태를 변경하면 같은 Spreadsheet의 운영 상태 탭에 기록합니다.</li>
          <li>- 워크스페이스(파티) 단위로 소유자와 운영자를 나눠 함께 운영합니다.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold">사용하는 Google 권한</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          로그인 시 Google 계정의 기본 정보(이름·이메일)와, 연결한 Spreadsheet를 읽고 쓰기
          위한 Google Sheets 권한을 요청합니다. 수집·사용·보관 방식은{' '}
          <Link className="text-emerald-300 hover:text-emerald-200" href="/privacy">
            개인정보처리방침
          </Link>
          에 자세히 설명되어 있습니다.
        </p>

        <p className="mt-10 text-xs text-slate-500">
          문의:{' '}
          <a
            className="text-slate-400 hover:text-slate-300"
            href="https://github.com/jun20082/GFArtist/issues"
            rel="noreferrer"
            target="_blank"
          >
            github.com/jun20082/GFArtist/issues
          </a>
        </p>
      </article>
    </main>
  );
}
