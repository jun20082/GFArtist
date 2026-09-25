import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-box';

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
      'Google Sheets 권한이 없습니다. 로그아웃한 뒤 다시 로그인해 스프레드시트 접근을 승인하세요. ' +
        `(현재 승인된 범위: ${account.scope})`,
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

type AppsScriptConfig = {
  appsScriptUrl?: string | null;
  appsScriptSecretEncrypted?: string | null;
};

/**
 * Ensures the source sheet has internal response ids by calling the Apps
 * Script Web App of the workspace. Workspaces that never stored their own Web
 * App fall back to the GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SECRET
 * environment variables.
 */
export async function ensureAppsScriptIds(sourceSettings: AppsScriptConfig) {
  const url = sourceSettings.appsScriptUrl ?? process.env.GOOGLE_APPS_SCRIPT_URL;
  let secret: string | null = null;

  if (sourceSettings.appsScriptUrl) {
    if (!sourceSettings.appsScriptSecretEncrypted) {
      throw new Error(
        '이 워크스페이스에는 Apps Script Secret이 저장되어 있지 않습니다. Sheets 설정에서 Secret을 입력하세요.',
      );
    }

    const key = process.env.APP_ENCRYPTION_KEY;

    if (!key) {
      throw new Error('APP_ENCRYPTION_KEY is not configured.');
    }

    secret = decryptSecret(sourceSettings.appsScriptSecretEncrypted, key);
  } else {
    secret = process.env.GOOGLE_APPS_SCRIPT_SECRET ?? null;
  }

  if (!url || !secret) {
    throw new Error(
      'Apps Script Web App 구성이 없습니다. Sheets 설정에서 Web App URL과 Secret을 입력하세요.',
    );
  }

  if (!url.endsWith('/exec')) {
    throw new Error(
      `Apps Script Web App URL must end with /exec. Current value: ${url}`,
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
        'Check that the Web App URL points at the current deployment.',
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
