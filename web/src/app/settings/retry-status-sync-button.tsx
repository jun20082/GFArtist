'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RetryStatusSyncButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleClick() {
    setMessage(null);
    setError(null);
    setIsRetrying(true);

    const response = await fetch('/api/sync/operating-status', { method: 'POST' });
    const result = (await response.json()) as {
      error?: string;
      total?: number;
      succeeded?: number;
      failed?: number;
    };
    setIsRetrying(false);

    if (!response.ok) {
      setError(result.error ?? '재시도에 실패했습니다.');
      return;
    }

    setMessage(`재시도 완료: 성공 ${result.succeeded ?? 0}건 / 실패 ${result.failed ?? 0}건`);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">운영 상태 재동기화</h2>
      <p className="text-sm leading-6 text-slate-300">
        운영 상태 탭 반영에 실패했거나 대기 중인 응답을 다시 반영합니다. 데이터베이스 상태는 그대로
        유지됩니다.
      </p>
      <p className="text-sm text-slate-400">대기·실패 {pendingCount}건</p>
      <button
        className="w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isRetrying || pendingCount === 0}
        onClick={handleClick}
        type="button"
      >
        {isRetrying ? '재시도 중...' : '재시도'}
      </button>
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
