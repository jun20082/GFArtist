import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ResponseActions } from '@/app/responses/[id]/response-actions';

export const dynamic = 'force-dynamic';

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const [response, categories] = await Promise.all([
    prisma.response.findUnique({ where: { id }, include: { category: true } }),
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
    { label: '성별', value: response.gender },
    { label: '주문 상품', value: response.orderedProduct },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/">
          목록으로
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: response.category.color }}
          />
          <h1 className="text-2xl font-semibold">{response.name}</h1>
          <span className="text-sm text-slate-400">{response.category.name}</span>
        </div>

        <dl className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
          {rows.map((row) => (
            <div className="flex justify-between gap-4" key={row.label}>
              <dt className="text-slate-400">{row.label}</dt>
              <dd className="text-right text-slate-100">{row.value || '-'}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">상태 동기화</dt>
            <dd className="text-right text-slate-100">{response.statusSyncState}</dd>
          </div>
          {response.lastStatusSyncError ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">동기화 오류</dt>
              <dd className="text-right text-rose-300">{response.lastStatusSyncError}</dd>
            </div>
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
            productStatus={response.productStatus}
            responseId={response.id}
          />
        </div>
      </div>
    </main>
  );
}
