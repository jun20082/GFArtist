'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type CategoryOption = {
  code: string;
  name: string;
  color: string;
};

type ResponseActionsProps = {
  responseId: string;
  categoryCode: string;
  entryStatus: string;
  productStatus: string;
  categories: CategoryOption[];
};

type SelectedState = {
  categoryCode: string;
  entryStatus: string;
  productStatus: string;
};

export function ResponseActions({
  responseId,
  categoryCode,
  entryStatus,
  productStatus,
  categories,
}: ResponseActionsProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedState>({
    categoryCode,
    entryStatus,
    productStatus,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function update(patch: Partial<SelectedState>) {
    const previous = selected;
    setError(null);
    setNotice(null);
    setIsSaving(true);
    setSelected((current) => ({ ...current, ...patch }));

    try {
      const response = await fetch(`/api/responses/${responseId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });

      const result = (await response.json()) as { error?: string; syncError?: string | null };

      if (!response.ok) {
        setSelected(previous);
        setError(result.error ?? '상태 변경에 실패했습니다.');
        return;
      }

      if (result.syncError) {
        setNotice(`저장됨. 운영 상태 탭 반영 실패: ${result.syncError}`);
      }

      router.refresh();
    } catch {
      setSelected(previous);
      setError('상태 변경에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <p className="text-sm text-slate-400">카테고리</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              aria-pressed={category.code === selected.categoryCode}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm transition disabled:opacity-50 ${
                category.code === selected.categoryCode
                  ? 'border-emerald-300 bg-emerald-300/10'
                  : 'border-white/15 hover:border-white/40'
              }`}
              disabled={isSaving || category.code === selected.categoryCode}
              key={category.code}
              onClick={() => update({ categoryCode: category.code })}
              type="button"
            >
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">입장 여부</span>
          <button
            aria-pressed={selected.entryStatus === 'ENTERED'}
            className={`min-w-24 whitespace-nowrap text-center min-h-11 rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 ${
              selected.entryStatus === 'ENTERED'
                ? 'bg-emerald-300/20 text-emerald-200 hover:bg-emerald-300/30'
                : 'bg-slate-500/20 text-slate-300 hover:bg-slate-500/30'
            }`}
            disabled={isSaving}
            onClick={() =>
              update({
                entryStatus: selected.entryStatus === 'ENTERED' ? 'NOT_ENTERED' : 'ENTERED',
              })
            }
            type="button"
          >
            {selected.entryStatus === 'ENTERED' ? '입장 완료' : '미입장'}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">상품 수령 여부</span>
          <button
            aria-pressed={selected.productStatus === 'RECEIVED'}
            className={`min-w-24 whitespace-nowrap text-center min-h-11 rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 ${
              selected.productStatus === 'RECEIVED'
                ? 'bg-sky-300/20 text-sky-200 hover:bg-sky-300/30'
                : 'bg-slate-500/20 text-slate-300 hover:bg-slate-500/30'
            }`}
            disabled={isSaving}
            onClick={() =>
              update({
                productStatus:
                  selected.productStatus === 'RECEIVED' ? 'NOT_RECEIVED' : 'RECEIVED',
              })
            }
            type="button"
          >
            {selected.productStatus === 'RECEIVED' ? '수령 완료' : '미수령'}
          </button>
        </div>
      </div>

      {notice ? (
        <p aria-live="polite" className="text-sm text-amber-300" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
