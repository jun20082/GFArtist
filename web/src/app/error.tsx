'use client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8"
        role="alert"
      >
        <h1 className="text-2xl font-semibold">오류가 발생했습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {error.message || '잠시 후 다시 시도하세요.'}
        </p>
        <button
          className="mt-6 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
          onClick={reset}
          type="button"
        >
          다시 시도
        </button>
      </section>
    </main>
  );
}
