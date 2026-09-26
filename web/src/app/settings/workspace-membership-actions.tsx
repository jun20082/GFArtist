'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type WorkspaceMembershipActionsProps = {
  role: 'OWNER' | 'OPERATOR';
  workspaceName: string;
};

export function WorkspaceMembershipActions({
  role,
  workspaceName,
}: WorkspaceMembershipActionsProps) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isOwner = role === 'OWNER';
  const canSubmit = !isOwner || confirmName.trim() === workspaceName;

  async function handleDetach() {
    if (isOwner) {
      if (confirmName.trim() !== workspaceName) {
        return;
      }
    } else if (!window.confirm(`"${workspaceName}" 워크스페이스에서 나갑니다. 계속할까요?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch('/api/workspace', { method: 'DELETE' });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(
          result.error ??
            (isOwner ? '워크스페이스 삭제에 실패했습니다.' : '나가기에 실패했습니다.'),
        );
        return;
      }

      setConfirmName('');
      setMessage(
        isOwner
          ? '워크스페이스를 삭제했습니다. 연결된 Google 시트 자체는 변경되지 않았습니다.'
          : '워크스페이스에서 나갔습니다.',
      );
      router.refresh();
    } catch {
      setError('요청에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-rose-300/30 bg-rose-300/5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {isOwner ? '워크스페이스 삭제' : '워크스페이스 나가기'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {isOwner
            ? '워크스페이스와 저장된 설정·응답 데이터가 삭제되고, 운영자도 접근할 수 없게 됩니다. Google 시트 자체는 변경되지 않습니다. 되돌릴 수 없습니다.'
            : '이 워크스페이스에서 나가면 접근할 수 없게 됩니다. 소유자가 다시 초대하면 재참여할 수 있습니다.'}
        </p>
      </div>

      {isOwner ? (
        <label className="block text-sm text-slate-200">
          확인을 위해 워크스페이스 이름(&quot;{workspaceName}&quot;)을 입력하세요
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
            onChange={(event) => setConfirmName(event.target.value)}
            value={confirmName}
          />
        </label>
      ) : null}

      <button
        className="rounded-xl bg-rose-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy || !canSubmit}
        onClick={handleDetach}
        type="button"
      >
        {isBusy ? '처리 중...' : isOwner ? '워크스페이스 삭제' : '워크스페이스에서 나가기'}
      </button>

      {message ? (
        <p aria-live="polite" className="text-sm text-emerald-300" role="status">
          {message}{' '}
          <Link className="underline" href="/">
            홈으로 이동
          </Link>
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
