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
        className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="이름 또는 전화번호 검색"
            className="w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
            name="q"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
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
    </>
  );
}
