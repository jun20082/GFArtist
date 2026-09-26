import { StatusSyncState } from '@/generated/prisma/enums';
import type { EntryStatus, ProductStatus } from '@/generated/prisma/enums';
import type { SourceSettings } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/workspace';
import {
  columnLetter,
  formatEntryStatus,
  formatProductStatus,
  operatingStatusHeaders,
  quoteSheetName,
} from '@/lib/sheet-format';

export type ResponseForSync = {
  id: string;
  internalResponseId: string;
  name: string;
  phoneRaw: string;
  entryStatus: EntryStatus;
  productStatus: ProductStatus;
};

export type OperatingStatusWriteResult =
  | { action: 'updated'; rowNumber: number }
  | { action: 'appended' };

export type OperatingStatusWriter = (
  userId: string,
  sourceSettings: SourceSettings,
  response: ResponseForSync,
) => Promise<OperatingStatusWriteResult>;

export function buildOperatingStatusValues(response: ResponseForSync) {
  return new Map<string, string>([
    ['_internal_response_id', response.internalResponseId],
    ['이름', response.name],
    ['전화번호', response.phoneRaw],
    ['입장 여부', formatEntryStatus(response.entryStatus)],
    ['상품 수령 여부', formatProductStatus(response.productStatus)],
  ]);
}

export function buildOperatingStatusRow(
  headers: string[],
  currentRow: unknown[],
  managedValues: Map<string, string>,
) {
  return headers.map((header, index) => {
    const managed = managedValues.get(header);
    return managed === undefined ? String(currentRow[index] ?? '') : managed;
  });
}

export function findOperatingStatusRowIndex(
  rows: unknown[][],
  idIndex: number,
  internalResponseId: string,
) {
  return rows.findIndex((row) => String(row[idIndex] ?? '').trim() === internalResponseId);
}

export function findOperatingStatusRowIndexes(
  rows: unknown[][],
  idIndex: number,
  internalResponseId: string,
) {
  const indexes: number[] = [];

  rows.forEach((row, index) => {
    if (String(row[idIndex] ?? '').trim() === internalResponseId) {
      indexes.push(index);
    }
  });

  return indexes;
}

/**
 * A duplicated internal id means the operating status tab has two rows for the
 * same response. Updating only the first row would leave a stale duplicate, so
 * refuse the sync and point the manager at the cleanup action.
 */
export function assertSingleOperatingStatusRow(
  matchingIndexes: number[],
  internalResponseId: string,
) {
  if (matchingIndexes.length > 1) {
    throw new Error(
      `운영 상태 탭에 같은 내부 ID가 ${matchingIndexes.length}개 행 있습니다(${internalResponseId}). ` +
        'Sheets 설정의 "운영 상태 중복 정리"를 먼저 실행하세요.',
    );
  }
}

/** Minimal Sheets surface so tests can pass a fake client. */
export type OperatingStatusSheetsClient = {
  spreadsheets: {
    values: {
      get: (params: {
        spreadsheetId: string;
        range: string;
      }) => Promise<{ data: { values?: unknown[][] } }>;
      update: (params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: 'RAW';
        requestBody: { values: string[][] };
      }) => Promise<unknown>;
      append: (params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: 'RAW';
        insertDataOption: 'INSERT_ROWS';
        requestBody: { values: string[][] };
      }) => Promise<unknown>;
    };
  };
};

/**
 * Writes the operating status of one response to the source spreadsheet's
 * operating status tab. Only the managed columns are written; respondent
 * columns such as 비고 are preserved.
 */
export async function writeOperatingStatus(
  userId: string,
  sourceSettings: SourceSettings,
  response: ResponseForSync,
  sheetsClient?: OperatingStatusSheetsClient,
): Promise<OperatingStatusWriteResult> {
  let sheets = sheetsClient;

  if (!sheets) {
    const { getSheetsClient } = await import('@/lib/google-sheets');
    sheets = (await getSheetsClient(userId)) as unknown as OperatingStatusSheetsClient;
  }

  const prefix = quoteSheetName(sourceSettings.operatingStatusSheetName);
  const spreadsheetId = sourceSettings.spreadsheetId;

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${prefix}!A:Z`,
  });
  const rows = existing.data.values ?? [];
  let headers = (rows[0] ?? []).map((value) => String(value ?? '').trim());

  if (headers.length === 0) {
    headers = [...operatingStatusHeaders];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${prefix}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  const idIndex = headers.indexOf('_internal_response_id');

  if (idIndex === -1) {
    throw new Error('운영 상태 탭에 _internal_response_id 컬럼이 없습니다.');
  }

  const managedValues = buildOperatingStatusValues(response);
  const dataRows = rows.slice(1);
  const matchingIndexes = findOperatingStatusRowIndexes(
    dataRows,
    idIndex,
    response.internalResponseId,
  );

  assertSingleOperatingStatusRow(matchingIndexes, response.internalResponseId);

  const targetIndex = matchingIndexes[0] ?? -1;

  if (targetIndex >= 0) {
    const sheetRow = targetIndex + 2;
    const values = buildOperatingStatusRow(headers, dataRows[targetIndex], managedValues);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${prefix}!A${sheetRow}:${columnLetter(values.length - 1)}${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
    return { action: 'updated', rowNumber: sheetRow };
  }

  const values = buildOperatingStatusRow(headers, [], managedValues);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${prefix}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
  return { action: 'appended' };
}

const defaultOperatingStatusWriter: OperatingStatusWriter = writeOperatingStatus;

const SYNC_LOCK_TIMEOUT = '10s';
const SYNC_TRANSACTION_TIMEOUT_MS = 25_000;
const SYNC_TRANSACTION_MAX_WAIT_MS = 10_000;

/**
 * Serializes the operating status sync per response with a PostgreSQL advisory
 * lock. Two concurrent syncs of the same response would otherwise both read the
 * sheet before either appended, creating duplicate rows for one internal id.
 * The lock is scoped to the transaction, so other responses stay parallel.
 */
export async function syncResponseStatus(
  userId: string,
  responseId: string,
  writer: OperatingStatusWriter = defaultOperatingStatusWriter,
) {
  const outcome = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('lock_timeout', ${SYNC_LOCK_TIMEOUT}, true)`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${responseId})::bigint)::text AS locked`;

      const response = await tx.response.findUnique({
        where: { id: responseId },
        include: { sourceSettings: true },
      });

      if (!response) {
        throw new Error('Response not found.');
      }

      const membership = await tx.workspaceMember.findFirst({
        where: {
          userId,
          workspaceId: response.sourceSettings.workspaceId ?? '__unassigned__',
        },
        select: { id: true },
      });

      if (!membership) {
        throw new Error('Response not found.');
      }

      try {
        const result = await writer(userId, response.sourceSettings, response);

        await tx.response.update({
          where: { id: response.id },
          data: {
            statusSyncState: StatusSyncState.SYNCED,
            lastStatusSyncAt: new Date(),
            lastStatusSyncError: null,
          },
        });

        return { ok: true as const, result };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operating status sync failed.';

        await tx.response.update({
          where: { id: response.id },
          data: {
            statusSyncState: StatusSyncState.FAILED,
            lastStatusSyncError: message,
          },
        });

        return { ok: false as const, message };
      }
    },
    {
      maxWait: SYNC_TRANSACTION_MAX_WAIT_MS,
      timeout: SYNC_TRANSACTION_TIMEOUT_MS,
    },
  );

  if (!outcome.ok) {
    throw new Error(outcome.message);
  }

  return outcome.result;
}

export async function retryPendingStatusSync(
  userId: string,
  writer: OperatingStatusWriter = defaultOperatingStatusWriter,
) {
  const context = await getWorkspaceContext(userId);
  const sourceSettings = context?.sourceSettings;

  if (!sourceSettings) {
    throw new Error('활성 파티가 없습니다.');
  }

  const targets = await prisma.response.findMany({
    where: {
      sourceSettingsId: sourceSettings.id,
      statusSyncState: { in: [StatusSyncState.PENDING, StatusSyncState.FAILED] },
    },
    orderBy: { updatedAt: 'asc' },
  });

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const target of targets) {
    try {
      await syncResponseStatus(userId, target.id, writer);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown error.';
      errors.push(`${target.name}: ${message}`);
    }
  }

  return { total: targets.length, succeeded, failed, errors };
}
