'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export type InviteItem = {
  id: string;
  email: string;
  status: string;
  acceptedAt: string | null;
};

const statusLabels: Record<string, string> = {
  INVITED: '대기',
  ACTIVE: '참여 중',
  REVOKED: '취소됨',
};

export function InviteManager({ invites }: { invites: InviteItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsBusy(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const form = event.currentTarget;

    try {
      const response = await fetch('/api/workspace/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(result.error ?? '초대에 실패했습니다.');
        return;
      }

      form.reset();
      setMessage(`${email} 주소를 초대했습니다. 그 계정으로 로그인하면 이 워크스페이스에 참여합니다.`);
      router.refresh();
    } catch {
      setError('초대에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    setMessage(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/workspace/invites/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(result.error ?? '초대 취소에 실패했습니다.');
        return;
      }

      setMessage('초대를 취소했습니다. 해당 계정은 더 이상 로그인할 수 없습니다.');
      router.refresh();
    } catch {
      setError('초대 취소에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold">운영자 초대</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          이메일을 초대하면 서버 허용 목록에 없어도 그 Google 계정으로 로그인할 수 있고, 로그인 시 이
          워크스페이스의 운영자로 참여합니다. 초대된 운영자도 상태 변경을 위해 스프레드시트 편집
          권한이 필요합니다.
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-300/90">
          Google Cloud OAuth 동의 화면이 &quot;테스트&quot; 상태이면 그 계정이 테스트 사용자로도
          등록되어 있어야 로그인할 수 있습니다. 외부 사용자를 제한 없이 받으려면 앱 게시(검증)가
          필요합니다.
        </p>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleInvite}>
        <input
          className="w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
        <button
          className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy}
          type="submit"
        >
          초대
        </button>
      </form>

      {invites.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
          {invites.map((invite) => (
            <li className="flex items-center justify-between gap-3" key={invite.id}>
              <span>
                {invite.email} · {statusLabels[invite.status] ?? invite.status}
                {invite.acceptedAt ? ` · ${invite.acceptedAt}` : ''}
              </span>
              {invite.status === 'REVOKED' ? null : (
                <button
                  className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-200 transition hover:border-white/40 disabled:opacity-50"
                  disabled={isBusy}
                  onClick={() => handleRevoke(invite.id)}
                  type="button"
                >
                  취소
                </button>
              )}
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
