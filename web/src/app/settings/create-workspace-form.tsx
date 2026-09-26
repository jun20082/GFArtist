'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const inputClassName =
  'mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300';

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result.error ?? '워크스페이스 생성에 실패했습니다.');
      return;
    }

    setName('');
    router.refresh();
  }

  return (
    <form
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="font-medium text-white">새 워크스페이스 만들기</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          이름을 입력하면 이 계정이 소유자가 되는 워크스페이스가 만들어지고 바로 전환됩니다.
        </p>
      </div>

      <label className="block text-sm text-slate-200">
        워크스페이스 이름
        <input
          className={inputClassName}
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="우리 파티"
          required
          value={name}
        />
      </label>

      <button
        className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? '만드는 중...' : '워크스페이스 만들기'}
      </button>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
