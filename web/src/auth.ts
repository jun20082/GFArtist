import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

function getAllowedEmails() {
  return new Set(
    (process.env.GOOGLE_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/spreadsheets',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: '/login',
  },
  events: {
    /**
     * Auth.js does not refresh the stored OAuth tokens when an already-linked
     * account signs in again (see @auth/core handle-login). Without this, an
     * account keeps the scopes from its very first login forever.
     */
    async signIn({ account }) {
      if (!account || account.type === 'credentials') {
        return;
      }

      const data: {
        access_token?: string | null;
        refresh_token?: string | null;
        expires_at?: number | null;
        scope?: string | null;
        token_type?: string | null;
        id_token?: string | null;
        session_state?: string | null;
      } = {
        access_token: account.access_token ?? null,
        expires_at: account.expires_at ?? null,
        scope: account.scope ?? null,
        token_type: account.token_type ?? null,
        id_token: account.id_token ?? null,
      };

      if (typeof account.session_state === 'string') {
        data.session_state = account.session_state;
      }

      if (typeof account.refresh_token === 'string' && account.refresh_token.length > 0) {
        data.refresh_token = account.refresh_token;
      }

      await prisma.account.updateMany({
        where: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
        data,
      });
    },
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      return Boolean(email && getAllowedEmails().has(email));
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = typeof token.id === 'string' ? token.id : token.sub;

      if (session.user && userId) {
        session.user.id = userId;
      }

      return session;
    },
  },
});
