'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type MemberItem = {
  userId: string;
  label: string;
  role: string;
  joinedAt: string;
  canRemove: boolean;
};

export function MemberManager({ members }: { members: MemberItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleRemove(member: MemberItem) {
    if (!window.confirm(`${member.label} 님을 이 워크스페이스에서 제거합니다. 계속할까요?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/workspace/members/${member.userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(result.error ?? '멤버 제거에 실패했습니다.');
        return;
      }

      setMessage(`${member.label} 님을 제거했습니다. 해당 계정은 이 워크스페이스에 접근할 수 없습니다.`);
      router.refresh();
    } catch {
      setError('멤버 제거에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold">멤버 관리</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          제거하면 그 계정의 워크스페이스 소속과 초대가 함께 취소됩니다. 소유자는 제거할 수
          없습니다.
        </p>
      </div>

      <ul className="space-y-1 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
        {members.map((member) => (
          <li className="flex items-center justify-between gap-3" key={member.userId}>
            <span className="min-w-0 flex-1 break-all">
              {member.label} · {member.role} · {member.joinedAt}
            </span>
            {member.canRemove ? (
              <button
                className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 transition hover:border-rose-300/60 disabled:opacity-50"
                disabled={isBusy}
                onClick={() => handleRemove(member)}
                type="button"
              >
                제거
              </button>
            ) : null}
          </li>
        ))}
      </ul>

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
