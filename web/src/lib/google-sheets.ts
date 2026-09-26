import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

type SheetsClient = ReturnType<typeof google.sheets>;

const sheetsClientCache = new Map<string, { fingerprint: string; sheets: SheetsClient }>();

const REQUIRED_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function hasRequiredSheetsScope(scope: string | null) {
  if (!scope) {
    return true;
  }

  return scope
    .split(/\s+/)
    .filter(Boolean)
    .includes(REQUIRED_SHEETS_SCOPE);
}

export async function getSheetsClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google',
    },
  });

  if (!account) {
    throw new Error('Google account connection was not found.');
  }

  if (!hasRequiredSheetsScope(account.scope)) {
    throw new Error(
      'Google Sheets 沅뚰븳???놁뒿?덈떎. 濡쒓렇?꾩썐?????ㅼ떆 濡쒓렇?명빐 ?ㅽ봽?덈뱶?쒗듃 ?묎렐???뱀씤?섏꽭?? ' +
        `(?꾩옱 ?뱀씤??踰붿쐞: ${account.scope})`,
    );
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured.');
  }

  const fingerprint = [
    account.id,
    account.access_token ?? '',
    account.refresh_token ?? '',
    account.expires_at ?? '',
  ].join('|');

  const cached = sheetsClientCache.get(userId);

  if (cached && cached.fingerprint === fingerprint) {
    return cached.sheets;
  }

  const oauthClient = new google.auth.OAuth2(clientId, clientSecret);
  oauthClient.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  oauthClient.on('tokens', (tokens) => {
    const data: {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      scope?: string;
    } = {};

    if (tokens.access_token) {
      data.access_token = tokens.access_token;
    }

    if (typeof tokens.expiry_date === 'number') {
      data.expires_at = Math.floor(tokens.expiry_date / 1000);
    }

    if (tokens.refresh_token) {
      data.refresh_token = tokens.refresh_token;
    }

    if (tokens.scope) {
      data.scope = tokens.scope;
    }

    if (Object.keys(data).length === 0) {
      return;
    }

    void prisma.account
      .update({ where: { id: account.id }, data })
      .catch(() => undefined);
  });

  const sheets = google.sheets({ version: 'v4', auth: oauthClient });
  sheetsClientCache.set(userId, { fingerprint, sheets });

  return sheets;
}

export { parseSpreadsheetId, quoteSheetName } from '@/lib/sheet-format';
