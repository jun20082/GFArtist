import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getResponseForMember } from '@/lib/workspace';
import { ResponseActions } from '@/app/responses/[id]/response-actions';

export const dynamic = 'force-dynamic';

function extraFieldRows(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).map(([label, raw]) => ({
    label,
    value: raw === null || raw === undefined ? '' : String(raw),
  }));
}

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const [response, categories] = await Promise.all([
    getResponseForMember(session.user.id, id),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!response) {
    notFound();
  }

  const rows = [
    { label: '이름', value: response.name },
    { label: '전화번호', value: response.phoneRaw },
    ...(response.gender ? [{ label: '성별', value: response.gender }] : []),
    ...(response.orderedProduct ? [{ label: '주문 상품', value: response.orderedProduct }] : []),
    ...extraFieldRows(response.extraFields),
  ];

  const syncStateLabels: Record<string, string> = {
    SYNCED: '운영 상태 탭 반영 완료',
    PENDING: '반영 대기',
    FAILED: '반영 실패',
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/">
          목록으로
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: response.category.color }}
          />
          <h1 className="min-w-0 break-words text-2xl font-semibold">{response.name}</h1>
          <span className="text-sm text-slate-400">{response.category.name}</span>
        </div>

        <dl className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
          {rows.map((row) => (
            <div className="flex justify-between gap-4" key={row.label}>
              <dt className="shrink-0 text-slate-400">{row.label}</dt>
              <dd className="min-w-0 break-words text-right text-slate-100">
                {row.value || '-'}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">상태 동기화</dt>
            <dd className="text-right text-slate-100">
              {syncStateLabels[response.statusSyncState] ?? response.statusSyncState}
            </dd>
          </div>
          {response.lastStatusSyncError ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">동기화 오류</dt>
              <dd className="text-right text-rose-300">{response.lastStatusSyncError}</dd>
            </div>
          ) : null}
          {response.statusSyncState === 'FAILED' ? (
            <p className="text-xs text-slate-400">
              Sheets 설정 화면의 재시도 버튼으로 운영 상태 탭 반영을 다시 시도할 수 있습니다.
            </p>
          ) : null}
        </dl>

        <div className="mt-6">
          <ResponseActions
            categories={categories.map((category) => ({
              code: category.code,
              name: category.name,
              color: category.color,
            }))}
            categoryCode={response.categoryCode}
            entryStatus={response.entryStatus}
            key={response.id}
            productStatus={response.productStatus}
            responseId={response.id}
          />
        </div>
      </div>
    </main>
  );
}
