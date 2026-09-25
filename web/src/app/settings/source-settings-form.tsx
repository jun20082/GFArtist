'use client';

import { FormEvent, useState } from 'react';

type SourceSettingsFormProps = {
  appsScriptUrl: string | null;
  hasAppsScriptSecret: boolean;
};

export function SourceSettingsForm({
  appsScriptUrl,
  hasAppsScriptSecret,
}: SourceSettingsFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const appsScriptSecret = formData.get('appsScriptSecret');
    const response = await fetch('/api/source-settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        partyName: formData.get('partyName'),
        spreadsheetUrlOrId: formData.get('spreadsheetUrlOrId'),
        responseSheetName: formData.get('responseSheetName'),
        operatingStatusSheetName: formData.get('operatingStatusSheetName'),
        appsScriptUrl: formData.get('appsScriptUrl'),
        ...(appsScriptSecret ? { appsScriptSecret } : {}),
      }),
    });

    const result = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result.error ?? '연결에 실패했습니다.');
      return;
    }

    setMessage('Google Sheets 연결이 저장되었습니다.');
  }

  return (
    <form
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
      onSubmit={handleSubmit}
    >
      <label className="block text-sm text-slate-200">
        파티명
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
          name="partyName"
          placeholder="조커이즈 할로윈 파티"
          required
        />
      </label>

      <label className="block text-sm text-slate-200">
        Google Sheets URL 또는 ID
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
          name="spreadsheetUrlOrId"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          required
        />
      </label>

      <label className="block text-sm text-slate-200">
        원본 응답 탭 이름
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
          defaultValue="설문지 응답"
          name="responseSheetName"
          required
        />
      </label>

      <label className="block text-sm text-slate-200">
        운영 상태 탭 이름
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
          defaultValue="운영 상태"
          name="operatingStatusSheetName"
          required
        />
      </label>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <p className="text-xs leading-5 text-slate-400">
          Apps Script Web App 설정 (선택). 각 파티의 Web App URL과 Secret을 저장하면 이 파티에만
          사용됩니다. 비워 두면 서버 환경변수(GOOGLE_APPS_SCRIPT_URL)를 사용합니다.
        </p>

        <label className="block text-sm text-slate-200">
          Apps Script Web App URL
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
            defaultValue={appsScriptUrl ?? ''}
            name="appsScriptUrl"
            placeholder="https://script.google.com/macros/s/.../exec"
            type="url"
          />
        </label>

        <label className="block text-sm text-slate-200">
          Apps Script Secret{' '}
          <span className="text-xs text-slate-400">
            {hasAppsScriptSecret ? '(저장됨 — 새 값을 입력하면 교체)' : '(미설정)'}
          </span>
          <input
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-300"
            name="appsScriptSecret"
            placeholder="Web App과 공유한 Secret"
            type="password"
          />
        </label>
      </div>

      <button
        className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? '연결 확인 중...' : '연결 저장'}
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
    </form>
  );
}
