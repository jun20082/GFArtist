import { randomUUID } from 'node:crypto';

export const internalResponseIdHeader = '_internal_response_id';

export function createInternalResponseId() {
  return `resp_${randomUUID()}`;
}

export type InternalIdPlan = {
  /** Index of the internal id column in the (possibly extended) header row. */
  idIndex: number;
  /** True when the id column must be added to the header row. */
  headerAdded: boolean;
  /** Header row to write when headerAdded is true. */
  headerRow: string[];
  /** One value per data row: existing id, generated id, or '' for untouched rows. */
  columnValues: string[];
  /** Data row indexes (0-based) that received a new id. */
  generatedIndexes: number[];
  /** Number of ids generated in this plan. */
  generatedCount: number;
};

export type InternalIdPlanInput = {
  headers: string[];
  rows: unknown[][];
  nameIndex: number;
  phoneIndex: number;
  idHeader?: string;
  generateId?: () => string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function cellText(row: unknown[], index: number) {
  if (index < 0) {
    return '';
  }

  return String(row[index] ?? '').trim();
}

/**
 * Decides which rows need an internal response id. Existing ids are never
 * touched, and rows without a name and phone stay untouched so half written
 * form submissions do not receive an id.
 */
export function planInternalIds({
  headers,
  rows,
  nameIndex,
  phoneIndex,
  idHeader = internalResponseIdHeader,
  generateId = createInternalResponseId,
}: InternalIdPlanInput): InternalIdPlan {
  const existingIndex = headers.findIndex(
    (header) => normalize(String(header ?? '')) === normalize(idHeader),
  );
  const headerAdded = existingIndex === -1;
  const idIndex = headerAdded ? headers.length : existingIndex;
  const headerRow = headerAdded ? [...headers, idHeader] : headers;
  const columnValues: string[] = [];
  const generatedIndexes: number[] = [];
  let generatedCount = 0;

  rows.forEach((row, index) => {
    const current = headerAdded ? '' : cellText(row, idIndex);

    if (current) {
      columnValues.push(current);
      return;
    }

    const hasIdentity = Boolean(cellText(row, nameIndex) || cellText(row, phoneIndex));

    if (!hasIdentity) {
      columnValues.push('');
      return;
    }

    columnValues.push(generateId());
    generatedIndexes.push(index);
    generatedCount += 1;
  });

  return { idIndex, headerAdded, headerRow, columnValues, generatedIndexes, generatedCount };
}
