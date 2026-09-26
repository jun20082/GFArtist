import type { SourceSettings } from '@/generated/prisma/client';
import { assertRespondentMappingPresent, type ColumnMapping } from '@/lib/column-mapping';
import { quoteSheetName } from '@/lib/sheet-format';
import { planInternalIds } from '@/lib/response-id';
import { writeInternalIds, type InternalIdSheetsClient } from '@/lib/response-id-writer';
import { prisma } from '@/lib/prisma';
import { applyResponseRowsInDb, type ResponseRow } from '@/lib/response-sync';
import type { WorkspaceContext } from '@/lib/workspace';

/** Sheets surface used by the response sync: read the tab, write the id column. */
export type ResponseSyncSheetsClient = InternalIdSheetsClient & {
  spreadsheets: {
    values: {
      get: (params: {
        spreadsheetId: string;
        range: string;
      }) => Promise<{ data: { values?: unknown[][] | null } }>;
    };
  };
};

export type ResponseSyncResult = {
  processedCount: number;
  generatedCount: number;
};

export type SyncAccess =
  | { ok: true; sourceSettings: SourceSettings }
  | { ok: false; status: 400 | 403; error: string };

export const SYNC_OWNER_ONLY_MESSAGE = '동기화는 워크스페이스 소유자만 실행할 수 있습니다.';

/**
 * The response sync writes the internal id column into the source sheet, so it
 * stays with the workspace owner. Operators keep search and status changes.
 */
export function resolveSyncAccess(context: WorkspaceContext | null): SyncAccess {
  if (!context?.sourceSettings) {
    return { ok: false, status: 400, error: '활성 파티가 없습니다.' };
  }

  if (context.role !== 'OWNER') {
    return { ok: false, status: 403, error: SYNC_OWNER_ONLY_MESSAGE };
  }

  return { ok: true, sourceSettings: context.sourceSettings };
}

function asText(value: unknown) {
  return String(value ?? '').trim();
}

async function resolveSheets(userId: string) {
  const { getSheetsClient } = await import('@/lib/google-sheets');

  return (await getSheetsClient(userId)) as unknown as ResponseSyncSheetsClient;
}

/**
 * Reads the response tab, fills missing internal ids in the sheet, and upserts
 * the rows into the database. Serialized per workspace with an advisory lock so
 * two syncs cannot generate different ids for the same blank row.
 */
export async function runResponseSync(
  userId: string,
  sourceSettings: SourceSettings,
  options: { sheets?: ResponseSyncSheetsClient; generateId?: () => string } = {},
): Promise<ResponseSyncResult> {
  const sheets = options.sheets ?? (await resolveSheets(userId));
  const prefix = quoteSheetName(sourceSettings.responseSheetName);
  const mapping: ColumnMapping = {
    nameHeader: sourceSettings.nameHeader,
    phoneHeader: sourceSettings.phoneHeader,
    genderHeader: sourceSettings.genderHeader,
    orderedProductHeader: sourceSettings.orderedProductHeader,
    internalResponseIdHeader: sourceSettings.internalResponseIdHeader,
  };

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('lock_timeout', '10s', true)`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceSettings.id})::bigint)::text AS locked`;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sourceSettings.spreadsheetId,
        range: `${prefix}!A:Z`,
      });

      const rows = response.data.values ?? [];
      const headers = (rows[0] ?? []).map((value) => asText(value));
      const dataRows = rows.slice(1);
      const indexes = new Map(headers.map((header, index) => [header, index]));

      assertRespondentMappingPresent(headers, mapping);

      const plan = planInternalIds({
        headers,
        rows: dataRows,
        nameIndex: indexes.get(mapping.nameHeader) ?? -1,
        phoneIndex: indexes.get(mapping.phoneHeader) ?? -1,
        idHeader: mapping.internalResponseIdHeader,
        generateId: options.generateId,
      });

      await writeInternalIds(
        userId,
        {
          spreadsheetId: sourceSettings.spreadsheetId,
          responseSheetName: sourceSettings.responseSheetName,
        },
        plan,
        sheets,
      );

      const responseRows: ResponseRow[] = dataRows
        .map((row, index) => ({
          internalResponseId: plan.columnValues[index] ?? '',
          name: asText(row[indexes.get(mapping.nameHeader) ?? -1]),
          phoneRaw: asText(row[indexes.get(mapping.phoneHeader) ?? -1]),
          gender: asText(row[indexes.get(mapping.genderHeader) ?? -1]),
          orderedProduct: asText(row[indexes.get(mapping.orderedProductHeader) ?? -1]),
          sourceRowNumber: index + 2,
        }))
        .filter((row) => row.internalResponseId && (row.name || row.phoneRaw));

      const processedCount = await applyResponseRowsInDb(tx, sourceSettings.id, responseRows);

      return { processedCount, generatedCount: plan.generatedCount };
    },
    { maxWait: 10_000, timeout: 25_000 },
  );
}
