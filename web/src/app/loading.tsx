export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <p aria-live="polite" className="text-sm text-slate-400" role="status">
          불러오는 중...
        </p>
      </div>
    </main>
  );
}
