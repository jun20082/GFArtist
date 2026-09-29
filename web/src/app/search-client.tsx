'use client';

import { useState } from 'react';
import Link from 'next/link';

type Category = {
  code: string;
  name: string;
  color: string;
};

type Response = {
  id: string;
  name: string;
  phoneRaw: string;
  orderedProduct: string;
  entryStatus: string;
  productStatus: string;
  category: Category;
};

type SearchClientProps = {
  initialQuery: string;
  initialEntry: string;
  initialProduct: string;
  initialResponses: Response[];
};

const entryOptions = [
  { value: '', label: '전체' },
  { value: 'ENTERED', label: '입장 완료' },
  { value: 'NOT_ENTERED', label: '미입장' },
];

const productOptions = [
  { value: '', label: '전체' },
  { value: 'RECEIVED', label: '상품 수령 완료' },
  { value: 'NOT_RECEIVED', label: '상품 미수령' },
];

export function SearchClient({
  initialQuery,
  initialEntry,
  initialProduct,
  initialResponses,
}: SearchClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [entry, setEntry] = useState(initialEntry);
  const [product, setProduct] = useState(initialProduct);
  const [responses, setResponses] = useState<Response[]>(initialResponses);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<string[]>([]);

  async function updateStatus(
    id: string,
    patch: { entryStatus?: string; productStatus?: string },
  ) {
    const previous = responses;

    setStatusError(null);
    setStatusNotice(null);
    setSavingIds((ids) => [...ids, id]);
    setResponses((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

    try {
      const response = await fetch(`/api/responses/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        syncError?: string | null;
        response?: { entryStatus: string; productStatus: string };
      };

      if (!response.ok) {
        setResponses(previous);
        setStatusError(result.error ?? '상태 변경에 실패했습니다.');
        return;
      }

      if (result.response) {
        const saved = result.response;
        setResponses((rows) =>
          rows.map((row) =>
            row.id === id
              ? { ...row, entryStatus: saved.entryStatus, productStatus: saved.productStatus }
              : row,
          ),
        );
      }

      if (result.syncError) {
        setStatusNotice(`저장됨. 운영 상태 탭 반영 실패: ${result.syncError}`);
      }
    } catch {
      setResponses(previous);
      setStatusError('상태 변경에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setSavingIds((ids) => ids.filter((value) => value !== id));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (entry) params.set('entry', entry);
    if (product) params.set('product', product);

    window.history.replaceState(null, '', params.toString() ? `?${params.toString()}` : '/');

    const response = await fetch(`/api/responses/search?${params.toString()}`);
    const result = (await response.json()) as { error?: string; responses?: Response[] };

    if (!response.ok) {
      setError(result.error ?? '검색에 실패했습니다.');
      return;
    }

    setResponses(result.responses ?? []);
  }

  return (
    <>
      <form
        autoComplete="off"
        className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="이름 또는 전화번호 검색"
            autoComplete="off"
            className="w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름 또는 전화번호 (뒷자리 가능)"
            type="text"
            value={query}
          />
          <button
            className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
            type="submit"
          >
            검색
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-xs text-slate-400">
            입장 여부
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
              name="entry"
              onChange={(event) => setEntry(event.target.value)}
              value={entry}
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
              name="product"
              onChange={(event) => setProduct(event.target.value)}
              value={product}
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

      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {statusError ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {statusError}
        </p>
      ) : null}
      {statusNotice ? (
        <p aria-live="polite" className="mt-3 text-sm text-amber-300" role="status">
          {statusNotice}
        </p>
      ) : null}

      {responses.length === 0 ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
          조건에 맞는 응답자가 없습니다. 이름이나 전화번호 뒷자리를 다시 확인하세요.
        </p>
      ) : null}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {responses.map((response) => {
          const isSaving = savingIds.includes(response.id);

          return (
            <li
              className="relative min-w-0 rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/30 focus-within:border-white/30"
              key={response.id}
            >
              <Link
                aria-label={`${response.name}, ${response.phoneRaw}, ${response.orderedProduct}, ${
                  response.category.name
                }, ${response.entryStatus === 'ENTERED' ? '입장 완료' : '미입장'}, ${
                  response.productStatus === 'RECEIVED' ? '수령 완료' : '미수령'
                }`}
                className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                href={`/responses/${response.id}`}
              />

              <div className="pointer-events-none relative z-10 flex h-full flex-col gap-3 px-4 py-6">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: response.category.color }}
                  />
                  <span className="truncate text-lg font-medium">{response.name}</span>
                </div>

                <dl className="space-y-1 text-sm text-slate-300">
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-400">전화번호</dt>
                    <dd className="min-w-0 break-words text-right">{response.phoneRaw || '-'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-400">주문 상품</dt>
                    <dd className="min-w-0 break-words text-right">
                      {response.orderedProduct || '-'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <button
                    aria-pressed={response.entryStatus === 'ENTERED'}
                    className={`pointer-events-auto min-h-11 min-w-24 whitespace-nowrap text-center rounded-md px-3 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 ${
                      response.entryStatus === 'ENTERED'
                        ? 'bg-emerald-300/20 text-emerald-200 hover:bg-emerald-300/30'
                        : 'bg-slate-500/20 text-slate-300 hover:bg-slate-500/30'
                    }`}
                    disabled={isSaving}
                    onClick={() =>
                      updateStatus(response.id, {
                        entryStatus:
                          response.entryStatus === 'ENTERED' ? 'NOT_ENTERED' : 'ENTERED',
                      })
                    }
                    type="button"
                  >
                    {response.entryStatus === 'ENTERED' ? '입장 완료' : '미입장'}
                  </button>
                  <button
                    aria-pressed={response.productStatus === 'RECEIVED'}
                    className={`pointer-events-auto min-h-11 min-w-24 whitespace-nowrap text-center rounded-md px-3 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 ${
                      response.productStatus === 'RECEIVED'
                        ? 'bg-sky-300/20 text-sky-200 hover:bg-sky-300/30'
                        : 'bg-slate-500/20 text-slate-300 hover:bg-slate-500/30'
                    }`}
                    disabled={isSaving}
                    onClick={() =>
                      updateStatus(response.id, {
                        productStatus:
                          response.productStatus === 'RECEIVED' ? 'NOT_RECEIVED' : 'RECEIVED',
                      })
                    }
                    type="button"
                  >
                    {response.productStatus === 'RECEIVED' ? '수령 완료' : '미수령'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
