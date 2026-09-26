import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { searchResponses } from '@/lib/responses';
import { getWorkspaceContext, getWorkspaceMemberships, workspaceRoleLabels } from '@/lib/workspace';
import { SearchClient } from '@/app/search-client';
import { WorkspaceSwitcher } from '@/app/workspace-switcher';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entry?: string; product?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const params = await searchParams;
  const context = await getWorkspaceContext(session.user.id);
  const memberships = await getWorkspaceMemberships(session.user.id);
  const sourceSettings = context?.sourceSettings ?? null;
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

  const subtitle = (() => {
    if (!context) {
      return '워크스페이스가 없습니다. Sheets 설정에서 파티를 연결하세요.';
    }

    const role = workspaceRoleLabels[context.role];

    return sourceSettings
      ? `${context.workspace.name} · ${sourceSettings.responseSheetName} · ${role}`
      : `${context.workspace.name} · 시트 연결 대기 중 · ${role}`;
  })();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
              Response Desk
            </p>
            <h1 className="mt-2 text-2xl font-semibold">응답자 검색</h1>
            <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <WorkspaceSwitcher memberships={memberships} />
            <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/settings">
              Sheets 설정
            </Link>
            <form action={handleSignOut}>
              <button
                className="min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/40"
                type="submit"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>

        {!context ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            <p className="font-medium text-white">아직 워크스페이스가 없습니다</p>
            <p className="mt-2 leading-6">
              Sheets 설정에서 자기 워크스페이스를 만든 뒤 자기 파티의 Google Sheets를 연결하면
              응답자 검색을 사용할 수 있습니다.
            </p>
            <Link
              className="mt-4 inline-block text-emerald-300 hover:text-emerald-200"
              href="/settings"
            >
              Sheets 설정으로 이동
            </Link>
          </div>
        ) : null}

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
