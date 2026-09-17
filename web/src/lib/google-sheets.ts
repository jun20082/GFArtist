import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

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

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured.');
  }

  const oauthClient = new google.auth.OAuth2(clientId, clientSecret);
  oauthClient.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  return google.sheets({ version: 'v4', auth: oauthClient });
}

export { parseSpreadsheetId, quoteSheetName } from '@/lib/sheet-format';

export async function ensureAppsScriptIds() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  if (!url || !secret) {
    throw new Error('Apps Script Web App configuration is missing.');
  }

  if (!url.endsWith('/exec')) {
    throw new Error(
      `GOOGLE_APPS_SCRIPT_URL must be the deployed Web App URL ending with /exec. Current value: ${url}`,
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'ensure_ids', secret }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Apps Script request failed with status ${response.status}. Target: ${url}. ` +
        'Check that GOOGLE_APPS_SCRIPT_URL points at the current Web App deployment.',
    );
  }

  const result = (await response.json()) as {
    ok?: boolean;
    error?: string;
    generatedCount?: number;
    totalResponseCount?: number;
  };

  if (!result.ok) {
    throw new Error(result.error ?? 'Apps Script returned an unknown error.');
  }

  return result;
}
