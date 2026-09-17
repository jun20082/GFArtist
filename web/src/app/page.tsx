import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { EntryStatus, ProductStatus } from '@/generated/prisma/enums';
import { getActiveSourceSettings } from '@/lib/source-settings';
import { searchResponses } from '@/lib/responses';

export const dynamic = 'force-dynamic';

const entryOptions: Array<{ value: '' | EntryStatus; label: string }> = [
  { value: '', label: '전체' },
  { value: 'ENTERED', label: '입장 완료' },
  { value: 'NOT_ENTERED', label: '미입장' },
];

const productOptions: Array<{ value: '' | ProductStatus; label: string }> = [
  { value: '', label: '전체' },
  { value: 'RECEIVED', label: '상품 수령 완료' },
  { value: 'NOT_RECEIVED', label: '상품 미수령' },
];

function parseEntry(value: string | undefined): EntryStatus | undefined {
  return value === 'ENTERED' || value === 'NOT_ENTERED' ? value : undefined;
}

function parseProduct(value: string | undefined): ProductStatus | undefined {
  return value === 'RECEIVED' || value === 'NOT_RECEIVED' ? value : undefined;
}

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
  const query = params.q ?? '';
  const entryStatus = parseEntry(params.entry);
  const productStatus = parseProduct(params.product);
  const sourceSettings = await getActiveSourceSettings();
  const responses = sourceSettings
    ? await searchResponses(sourceSettings.id, { query, entryStatus, productStatus })
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

        <form className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5" method="get">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="이름 또는 전화번호 검색"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
              defaultValue={query}
              name="q"
              placeholder="이름 또는 전화번호 (뒷자리 가능)"
            />
            <button
              className="rounded-xl bg-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
              type="submit"
            >
              검색
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1 text-xs text-slate-400">
              입장 여부
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
                defaultValue={entryStatus ?? ''}
                name="entry"
              >
                {entryOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs text-slate-400">
              상품 수령 여부
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
                defaultValue={productStatus ?? ''}
                name="product"
              >
                {productOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        <p aria-live="polite" className="mt-6 text-sm text-slate-400" role="status">
          검색 결과 {responses.length}건
        </p>

        {responses.length === 0 ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
            조건에 맞는 응답자가 없습니다. 이름이나 전화번호 뒷자리를 다시 확인하세요.
          </p>
        ) : null}

        <ul className="mt-3 space-y-2">
          {responses.map((response) => (
            <li key={response.id}>
              <Link
                aria-label={`${response.name}, ${response.category.name}, ${
                  response.entryStatus === 'ENTERED' ? '입장 완료' : '미입장'
                }, ${response.productStatus === 'RECEIVED' ? '수령 완료' : '미수령'}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/30 focus-visible:border-emerald-300 focus-visible:outline-none"
                href={`/responses/${response.id}`}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: response.category.color }}
                />
                <span className="font-medium">{response.name}</span>
                <span className="text-xs text-slate-400">{response.category.name}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-1 text-xs ${
                      response.entryStatus === 'ENTERED'
                        ? 'bg-emerald-300/20 text-emerald-200'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {response.entryStatus === 'ENTERED' ? '입장 완료' : '미입장'}
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-xs ${
                      response.productStatus === 'RECEIVED'
                        ? 'bg-sky-300/20 text-sky-200'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {response.productStatus === 'RECEIVED' ? '수령 완료' : '미수령'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
