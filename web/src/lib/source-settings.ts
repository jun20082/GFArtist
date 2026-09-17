import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSheetsClient, parseSpreadsheetId, quoteSheetName } from '@/lib/google-sheets';

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

export async function getActiveSourceSettings() {
  return prisma.sourceSettings.findFirst({
    where: { isActive: true },
  });
}
