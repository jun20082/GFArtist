'use client';

import { signIn } from 'next-auth/react';

export function SignInButton() {
  return (
    <button
      className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-100"
      onClick={() => signIn('google', { callbackUrl: '/' })}
      type="button"
    >
      Google 계정으로 로그인
    </button>
  );
}
