'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { workspaceRoleLabels, type WorkspaceRoleName } from '@/lib/workspace-labels';

export type WorkspaceSwitcherItem = {
  workspaceId: string;
  name: string;
  role: WorkspaceRoleName;
  isCurrent: boolean;
};

export function WorkspaceSwitcher({ memberships }: { memberships: WorkspaceSwitcherItem[] }) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = memberships.find((membership) => membership.isCurrent) ?? memberships[0];

  if (memberships.length < 2) {
    return null;
  }

  async function handleChange(workspaceId: string) {
    setIsSwitching(true);
    setError(null);

    try {
      const response = await fetch('/api/workspace/current', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(result.error ?? '워크스페이스 전환에 실패했습니다.');
        return;
      }

      router.refresh();
    } catch {
      setError('워크스페이스 전환에 실패했습니다. 네트워크를 확인하세요.');
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="text-xs text-slate-400" htmlFor="workspace-switcher">
        워크스페이스
      </label>
      <select
        key={current?.workspaceId ?? 'none'}
        className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300 disabled:opacity-50"
        defaultValue={current?.workspaceId}
        disabled={isSwitching}
        id="workspace-switcher"
        onChange={(event) => handleChange(event.target.value)}
      >
        {memberships.map((membership) => (
          <option key={membership.workspaceId} value={membership.workspaceId}>
            {membership.name} ({workspaceRoleLabels[membership.role]})
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-xs text-rose-300" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
