'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SyncResponsesButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleClick() {
    setMessage(null);
    setError(null);
    setIsSyncing(true);

    const response = await fetch('/api/sync/responses', { method: 'POST' });
    const result = (await response.json()) as { error?: string; processedCount?: number };
    setIsSyncing(false);

    if (!response.ok) {
      setError(result.error ?? '동기화에 실패했습니다.');
      return;
    }

    setMessage(`동기화 완료: ${result.processedCount ?? 0}건 반영`);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">응답 동기화</h2>
      <p className="text-sm leading-6 text-slate-300">
        원본 응답 탭에서 ID가 누락된 행을 보완하고, 응답 내용을 데이터베이스에 반영합니다.
        기존 카테고리와 입장·상품 상태는 유지됩니다.
      </p>
      <button
        className="w-full rounded-xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSyncing}
        onClick={handleClick}
        type="button"
      >
        {isSyncing ? '동기화 중...' : '지금 동기화'}
      </button>
      {message ? (
        <p aria-live="polite" className="text-sm text-emerald-300" role="status">
          {message}
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
