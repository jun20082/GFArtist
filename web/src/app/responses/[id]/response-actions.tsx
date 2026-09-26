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

      <div>
        <p className="text-sm text-slate-400">입장 여부</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            aria-pressed={selected.entryStatus === 'ENTERED'}
            className={`min-h-11 rounded-xl border px-5 py-2 text-sm transition disabled:opacity-50 ${
              selected.entryStatus === 'ENTERED'
                ? 'border-emerald-300 bg-emerald-300/10'
                : 'border-white/15 hover:border-white/40'
            }`}
            disabled={isSaving || selected.entryStatus === 'ENTERED'}
            onClick={() => update({ entryStatus: 'ENTERED' })}
            type="button"
          >
            입장 완료
          </button>
          <button
            aria-pressed={selected.entryStatus === 'NOT_ENTERED'}
            className={`min-h-11 rounded-xl border px-5 py-2 text-sm transition disabled:opacity-50 ${
              selected.entryStatus === 'NOT_ENTERED'
                ? 'border-emerald-300 bg-emerald-300/10'
                : 'border-white/15 hover:border-white/40'
            }`}
            disabled={isSaving || selected.entryStatus === 'NOT_ENTERED'}
            onClick={() => update({ entryStatus: 'NOT_ENTERED' })}
            type="button"
          >
            미입장
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-400">상품 수령 여부</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            aria-pressed={selected.productStatus === 'RECEIVED'}
            className={`min-h-11 rounded-xl border px-5 py-2 text-sm transition disabled:opacity-50 ${
              selected.productStatus === 'RECEIVED'
                ? 'border-sky-300 bg-sky-300/10'
                : 'border-white/15 hover:border-white/40'
            }`}
            disabled={isSaving || selected.productStatus === 'RECEIVED'}
            onClick={() => update({ productStatus: 'RECEIVED' })}
            type="button"
          >
            수령 완료
          </button>
          <button
            aria-pressed={selected.productStatus === 'NOT_RECEIVED'}
            className={`min-h-11 rounded-xl border px-5 py-2 text-sm transition disabled:opacity-50 ${
              selected.productStatus === 'NOT_RECEIVED'
                ? 'border-sky-300 bg-sky-300/10'
                : 'border-white/15 hover:border-white/40'
            }`}
            disabled={isSaving || selected.productStatus === 'NOT_RECEIVED'}
            onClick={() => update({ productStatus: 'NOT_RECEIVED' })}
            type="button"
          >
            미수령
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
