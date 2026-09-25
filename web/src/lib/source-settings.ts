import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { SourceSettings } from '@/generated/prisma/client';
import { parseSpreadsheetId, quoteSheetName } from '@/lib/sheet-format';
import { ensureOwnedWorkspace, getWorkspaceContext } from '@/lib/workspace';

export const sourceSettingsInput = z.object({
  partyName: z.string().trim().min(1).max(120),
  spreadsheetUrlOrId: z.string().trim().min(1),
  responseSheetName: z.string().trim().min(1).max(200),
  operatingStatusSheetName: z.string().trim().min(1).max(200),
});

export const requiredResponseHeaders = [
  '이름',
  '전화번호',
  '성별',
  '주문 상품',
  '_internal_response_id',
] as const;

export async function validateSourceSettings(
  userId: string,
  input: z.infer<typeof sourceSettingsInput>,
) {
  const spreadsheetId = parseSpreadsheetId(input.spreadsheetUrlOrId);
  const { getSheetsClient } = await import('@/lib/google-sheets');
  const sheets = await getSheetsClient(userId);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,sheets.properties',
  });

  const sheetNames = new Set(
    (metadata.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );

  if (!sheetNames.has(input.responseSheetName)) {
    throw new Error(`Response sheet tab not found: ${input.responseSheetName}`);
  }

  if (!sheetNames.has(input.operatingStatusSheetName)) {
    throw new Error(`Operating status tab not found: ${input.operatingStatusSheetName}`);
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(input.responseSheetName)}!1:1`,
  });
  const headers = (headerResponse.data.values?.[0] ?? []).map((value) => String(value).trim());
  const missingHeaders = requiredResponseHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing response headers: ${missingHeaders.join(', ')}`);
  }

  return { ...input, spreadsheetId };
}

const SETTINGS_CACHE_TTL_MS = 5_000;

const settingsCache = new Map<string, { value: SourceSettings; expiresAt: number }>();

export function invalidateSourceSettingsCache(userId?: string) {
  if (userId) {
    settingsCache.delete(userId);
    return;
  }

  settingsCache.clear();
}

/**
 * Returns the source settings of the caller's workspace. Each caller only ever
 * sees their own workspace, so the cache is keyed by user.
 */
export async function getWorkspaceSourceSettings(userId: string) {
  const cached = settingsCache.get(userId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const context = await getWorkspaceContext(userId);
  const value = context?.sourceSettings ?? null;

  if (!value) {
    settingsCache.delete(userId);
    return null;
  }

  settingsCache.set(userId, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });

  return value;
}

export type ValidatedSourceSettings = Awaited<ReturnType<typeof validateSourceSettings>>;

/**
 * Source settings for the browser. The Apps Script secret never leaves the
 * server; the UI only needs to know whether one is stored.
 */
export function toPublicSourceSettings(settings: SourceSettings) {
  const { appsScriptSecretEncrypted, ...rest } = settings;

  return {
    ...rest,
    hasAppsScriptSecret: Boolean(appsScriptSecretEncrypted),
  };
}

/**
 * Stores the caller's workspace settings. The first save also creates the
 * workspace. Only the workspace owner may change the connection, and a
 * spreadsheet cannot be claimed by two workspaces.
 */
export async function saveSourceSettings(userId: string, input: ValidatedSourceSettings) {
  const context = await getWorkspaceContext(userId);

  if (context && context.role !== 'OWNER') {
    throw new Error('워크스페이스 소유자만 Sheets 설정을 변경할 수 있습니다.');
  }

  const claimed = await prisma.sourceSettings.findUnique({
    where: { spreadsheetId: input.spreadsheetId },
  });

  const workspace = context?.workspace ?? (await ensureOwnedWorkspace(userId, input.partyName));

  if (claimed && claimed.workspaceId !== workspace.id) {
    throw new Error('이 스프레드시트는 다른 워크스페이스에서 이미 사용 중입니다.');
  }

  const saved = await prisma.sourceSettings.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      partyName: input.partyName,
      spreadsheetId: input.spreadsheetId,
      responseSheetName: input.responseSheetName,
      operatingStatusSheetName: input.operatingStatusSheetName,
      isActive: true,
    },
    update: {
      partyName: input.partyName,
      spreadsheetId: input.spreadsheetId,
      responseSheetName: input.responseSheetName,
      operatingStatusSheetName: input.operatingStatusSheetName,
      isActive: true,
    },
  });

  invalidateSourceSettingsCache(userId);

  return saved;
}
