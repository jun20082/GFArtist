import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { SourceSettings } from '@/generated/prisma/client';
import { parseSpreadsheetId, quoteSheetName } from '@/lib/sheet-format';
import { getWorkspaceContext } from '@/lib/workspace';
import { resolveColumnMapping, resolveDisplayColumns } from '@/lib/column-mapping';

export const sourceSettingsInput = z.object({
  partyName: z.string().trim().min(1).max(120),
  spreadsheetUrlOrId: z.string().trim().min(1),
  responseSheetName: z.string().trim().min(1).max(200),
  operatingStatusSheetName: z.string().trim().min(1).max(200),
  nameHeader: z.string().trim().optional(),
  phoneHeader: z.string().trim().optional(),
  genderHeader: z.string().trim().optional(),
  orderedProductHeader: z.string().trim().optional(),
  internalResponseIdHeader: z.string().trim().optional(),
  displayColumns: z.array(z.string().trim().min(1)).optional(),
});

export function missingTabMessage(label: string, tabName: string, availableTabs: string[]) {
  const tabs = availableTabs.length > 0 ? availableTabs.join(', ') : '(없음)';

  return `${label}: ${tabName}. 탭 이름을 확인해 주세요. 사용 가능한 탭: ${tabs}`;
}

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
    throw new Error(
      missingTabMessage(
        'Response sheet tab not found',
        input.responseSheetName,
        [...sheetNames],
      ),
    );
  }

  if (!sheetNames.has(input.operatingStatusSheetName)) {
    throw new Error(
      missingTabMessage(
        'Operating status tab not found',
        input.operatingStatusSheetName,
        [...sheetNames],
      ),
    );
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(input.responseSheetName)}!1:1`,
  });
  const headers = (headerResponse.data.values?.[0] ?? []).map((value) => String(value).trim());
  const mapping = resolveColumnMapping(headers, {
    nameHeader: input.nameHeader,
    phoneHeader: input.phoneHeader,
    genderHeader: input.genderHeader,
    orderedProductHeader: input.orderedProductHeader,
    internalResponseIdHeader: input.internalResponseIdHeader,
  });
  const displayColumns = resolveDisplayColumns(headers, input.displayColumns ?? []);

  return { ...input, spreadsheetId, mapping, displayColumns };
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
 * Stores the caller's current workspace settings. The workspace must already
 * exist (created explicitly first). Only the workspace owner may change the
 * connection, and a spreadsheet cannot be claimed by two workspaces.
 */
export async function saveSourceSettings(userId: string, input: ValidatedSourceSettings) {
  const context = await getWorkspaceContext(userId);

  if (!context) {
    throw new Error('워크스페이스가 없습니다. 먼저 워크스페이스를 만드세요.');
  }

  if (context.role !== 'OWNER') {
    throw new Error('워크스페이스 소유자만 Sheets 설정을 변경할 수 있습니다.');
  }

  const claimed = await prisma.sourceSettings.findUnique({
    where: { spreadsheetId: input.spreadsheetId },
  });

  const workspace = context.workspace;

  if (claimed && claimed.workspaceId !== workspace.id) {
    throw new Error('이 스프레드시트는 다른 워크스페이스에서 이미 사용 중입니다.');
  }

  const mapping = input.mapping;

  const saved = await prisma.$transaction(async (tx) => {
    const settings = await tx.sourceSettings.upsert({
      where: { workspaceId: workspace.id },
      create: {
        workspaceId: workspace.id,
        partyName: input.partyName,
        spreadsheetId: input.spreadsheetId,
        responseSheetName: input.responseSheetName,
        operatingStatusSheetName: input.operatingStatusSheetName,
        displayColumns: input.displayColumns,
        ...mapping,
      },
      update: {
        partyName: input.partyName,
        spreadsheetId: input.spreadsheetId,
        responseSheetName: input.responseSheetName,
        operatingStatusSheetName: input.operatingStatusSheetName,
        displayColumns: input.displayColumns,
        ...mapping,
      },
    });

    // The workspace is shown by its party name everywhere, so keep them in sync.
    await tx.workspace.update({
      where: { id: workspace.id },
      data: { name: input.partyName },
    });

    return settings;
  });

  invalidateSourceSettingsCache(userId);

  return saved;
}
