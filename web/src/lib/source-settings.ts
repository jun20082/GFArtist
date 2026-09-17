import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { SourceSettings } from '@/generated/prisma/client';
import { parseSpreadsheetId, quoteSheetName } from '@/lib/sheet-format';

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

const ACTIVE_SOURCE_SETTINGS_TTL_MS = 5_000;

let activeSourceSettingsCache: {
  value: SourceSettings;
  expiresAt: number;
} | null = null;

export function invalidateActiveSourceSettingsCache() {
  activeSourceSettingsCache = null;
}

export async function getActiveSourceSettings() {
  if (activeSourceSettingsCache && activeSourceSettingsCache.expiresAt > Date.now()) {
    return activeSourceSettingsCache.value;
  }

  const value = await prisma.sourceSettings.findFirst({
    where: { isActive: true },
  });

  activeSourceSettingsCache = value
    ? { value, expiresAt: Date.now() + ACTIVE_SOURCE_SETTINGS_TTL_MS }
    : null;

  return value;
}

export type ValidatedSourceSettings = Awaited<ReturnType<typeof validateSourceSettings>>;

/**
 * Stores the active source settings. Re-saving the same spreadsheet updates the
 * existing row instead of violating the unique constraint on spreadsheetId.
 */
export async function saveSourceSettings(input: ValidatedSourceSettings) {
  const saved = await prisma.$transaction(async (tx) => {
    await tx.sourceSettings.updateMany({
      where: { isActive: true, NOT: { spreadsheetId: input.spreadsheetId } },
      data: { isActive: false },
    });

    return tx.sourceSettings.upsert({
      where: { spreadsheetId: input.spreadsheetId },
      create: {
        partyName: input.partyName,
        spreadsheetId: input.spreadsheetId,
        responseSheetName: input.responseSheetName,
        operatingStatusSheetName: input.operatingStatusSheetName,
        isActive: true,
      },
      update: {
        partyName: input.partyName,
        responseSheetName: input.responseSheetName,
        operatingStatusSheetName: input.operatingStatusSheetName,
        isActive: true,
      },
    });
  });

  invalidateActiveSourceSettingsCache();

  return saved;
}
