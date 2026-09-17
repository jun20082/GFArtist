import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActiveSourceSettings } from '@/lib/source-settings';
import { searchResponses } from '@/lib/responses';
import { SearchClient } from '@/app/search-client';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entry?: string; product?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;
  const sourceSettings = await getActiveSourceSettings();
  const responses = sourceSettings
    ? await searchResponses(sourceSettings.id, {
        query: params.q ?? '',
        entryStatus: params.entry === 'ENTERED' || params.entry === 'NOT_ENTERED' ? params.entry : undefined,
        productStatus: params.product === 'RECEIVED' || params.product === 'NOT_RECEIVED' ? params.product : undefined,
      })
    : [];

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
              Sejin Response Desk
            </p>
            <h1 className="mt-2 text-2xl font-semibold">응답자 검색</h1>
            <p className="mt-2 text-sm text-slate-400">
              {sourceSettings
                ? `${sourceSettings.partyName} · ${sourceSettings.responseSheetName}`
                : '활성 파티가 없습니다. Sheets 설정을 먼저 완료하세요.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/settings">
              Sheets 설정
            </Link>
            <form action={handleSignOut}>
              <button
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/40"
                type="submit"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>

        {sourceSettings ? (
          <SearchClient
            initialEntry={params.entry ?? ''}
            initialProduct={params.product ?? ''}
            initialQuery={params.q ?? ''}
            initialResponses={responses}
          />
        ) : null}
      </div>
    </main>
  );
}
