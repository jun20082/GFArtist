'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Duplicate = {
  internalResponseId: string;
  rowNumbers: number[];
};

export function CleanupDuplicatesButton() {
  const router = useRouter();
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handlePreview() {
    setMessage(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch('/api/sync/operating-status/duplicates');
      const result = (await response.json()) as { error?: string; duplicates?: Duplicate[] };

      if (!response.ok) {
        setError(result.error ?? '중복 조회에 실패했습니다.');
        return;
      }

      const found = result.duplicates ?? [];
      setDuplicates(found);
      setMessage(
        found.length === 0
          ? '중복된 내부 ID가 없습니다.'
          : `중복된 내부 ID ${found.length}건을 찾았습니다.`,
      );
    } catch {
      setError('중복 조회에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCleanup() {
    if (!duplicates || duplicates.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `${duplicates.length}건의 중복 그룹에서 나머지 행을 삭제합니다. 운영 상태 시트에서 되돌릴 수 없습니다. 진행할까요?`,
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch('/api/sync/operating-status/duplicates', { method: 'POST' });
      const result = (await response.json()) as { error?: string; removedRowCount?: number };

      if (!response.ok) {
        setError(result.error ?? '중복 정리에 실패했습니다.');
        return;
      }

      setDuplicates(null);
      setMessage(`중복 정리 완료: ${result.removedRowCount ?? 0}개 행을 삭제했습니다.`);
      router.refresh();
    } catch {
      setError('중복 정리에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold">운영 상태 중복 정리</h2>
      <p className="text-sm leading-6 text-slate-300">
        운영 상태 탭에 같은 내부 ID가 두 줄 이상 생긴 경우, 최신 데이터베이스 상태를 첫 행에 기록하고
        나머지 중복 행을 삭제합니다. 먼저 중복을 확인한 뒤 정리를 실행하세요.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy}
          onClick={handlePreview}
          type="button"
        >
          {isBusy ? '확인 중...' : '중복 확인'}
        </button>
        <button
          className="w-full rounded-xl bg-rose-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy || !duplicates || duplicates.length === 0}
          onClick={handleCleanup}
          type="button"
        >
          중복 행 삭제
        </button>
      </div>
      {duplicates && duplicates.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
          {duplicates.map((duplicate) => (
            <li key={duplicate.internalResponseId}>
              {duplicate.internalResponseId} · 행 {duplicate.rowNumbers.join(', ')} (유지{' '}
              {duplicate.rowNumbers[0]})
            </li>
          ))}
        </ul>
      ) : null}
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
