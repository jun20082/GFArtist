import type { SourceSettings } from '@/generated/prisma/client';
import { getSheetsClient, quoteSheetName } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { columnLetter } from '@/lib/sheet-format';
import { buildOperatingStatusValues } from '@/lib/operating-status';
import { findDuplicateRowGroups, mergeRowValues } from '@/lib/duplicate-rows';

export type DuplicateCleanupPlanItem = {
  internalResponseId: string;
  keptRowNumber: number;
  removedRowNumbers: number[];
};

export type DuplicateCleanupResult = {
  groups: DuplicateCleanupPlanItem[];
  removedRowCount: number;
};

async function readOperatingStatus(userId: string, sourceSettings: SourceSettings) {
  const sheets = await getSheetsClient(userId);
  const prefix = quoteSheetName(sourceSettings.operatingStatusSheetName);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sourceSettings.spreadsheetId,
    range: `${prefix}!A:Z`,
  });
  const rows = response.data.values ?? [];
  const headers = (rows[0] ?? []).map((value) => String(value ?? '').trim());
  const idIndex = headers.indexOf('_internal_response_id');

  if (idIndex === -1) {
    throw new Error('운영 상태 탭에 _internal_response_id 컬럼이 없습니다.');
  }

  return { sheets, headers, idIndex, dataRows: rows.slice(1) };
}

async function resolveSheetId(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string,
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const sheetId = (metadata.data.sheets ?? []).find(
    (sheet) => sheet.properties?.title === sheetName,
  )?.properties?.sheetId;

  if (typeof sheetId !== 'number') {
    throw new Error(`운영 상태 탭을 찾을 수 없습니다: ${sheetName}`);
  }

  return sheetId;
}

export async function previewOperatingStatusDuplicates(
  userId: string,
  sourceSettings: SourceSettings,
) {
  const { idIndex, dataRows } = await readOperatingStatus(userId, sourceSettings);
  return findDuplicateRowGroups(dataRows, idIndex);
}

/**
 * Collapses duplicate operating status rows into a single row per internal
 * response id. The kept row receives the current database state plus any value
 * that only existed on a duplicate row; the remaining rows are deleted.
 */
export async function cleanupOperatingStatusDuplicates(
  userId: string,
  sourceSettings: SourceSettings,
): Promise<DuplicateCleanupResult> {
  const { sheets, headers, idIndex, dataRows } = await readOperatingStatus(
    userId,
    sourceSettings,
  );
  const groups = findDuplicateRowGroups(dataRows, idIndex);

  if (groups.length === 0) {
    return { groups: [], removedRowCount: 0 };
  }

  const responses = await prisma.response.findMany({
    where: {
      sourceSettingsId: sourceSettings.id,
      internalResponseId: { in: groups.map((group) => group.internalResponseId) },
    },
  });
  const responseById = new Map(
    responses.map((response) => [response.internalResponseId, response]),
  );

  const prefix = quoteSheetName(sourceSettings.operatingStatusSheetName);
  const plan: DuplicateCleanupPlanItem[] = [];

  for (const group of groups) {
    const [keptRowNumber, ...removedRowNumbers] = group.rowNumbers;
    const groupRows = group.rowNumbers.map((rowNumber) => dataRows[rowNumber - 2] ?? []);
    const merged = mergeRowValues(groupRows);
    const response = responseById.get(group.internalResponseId);
    const managedValues = response ? buildOperatingStatusValues(response) : null;
    const width = Math.max(headers.length, merged.length);
    const values: string[] = [];

    for (let index = 0; index < width; index += 1) {
      const header = headers[index];
      const managedValue =
        header && managedValues ? managedValues.get(header) : undefined;
      values.push(managedValue ?? merged[index] ?? '');
    }

    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sourceSettings.spreadsheetId,
        range: `${prefix}!A${keptRowNumber}:${columnLetter(values.length - 1)}${keptRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    }

    plan.push({ internalResponseId: group.internalResponseId, keptRowNumber, removedRowNumbers });
  }

  const rowsToDelete = plan
    .flatMap((item) => item.removedRowNumbers)
    .sort((a, b) => b - a);
  const sheetId = await resolveSheetId(
    sheets,
    sourceSettings.spreadsheetId,
    sourceSettings.operatingStatusSheetName,
  );

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sourceSettings.spreadsheetId,
    requestBody: {
      requests: rowsToDelete.map((rowNumber) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      })),
    },
  });

  return { groups: plan, removedRowCount: rowsToDelete.length };
}
