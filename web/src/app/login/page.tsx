import { SignInButton } from '@/app/login/sign-in-button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
          Response Desk
        </p>
        <h1 className="mt-4 text-3xl font-semibold">관리자 로그인</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          허용된 Google 계정으로 로그인해 참석자 응답을 관리하세요.
        </p>
        <div className="mt-8">
          <SignInButton />
        </div>
      </section>
    </main>
  );
}
