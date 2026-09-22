export type DuplicateRowGroup = {
  internalResponseId: string;
  rowNumbers: number[];
};

/**
 * Finds internal response ids that appear on more than one sheet row.
 * Row numbers are 1-based sheet coordinates (the header is row 1).
 */
export function findDuplicateRowGroups(
  rows: unknown[][],
  idIndex: number,
): DuplicateRowGroup[] {
  const rowsById = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const internalResponseId = String(row[idIndex] ?? '').trim();

    if (!internalResponseId) {
      return;
    }

    const existing = rowsById.get(internalResponseId) ?? [];
    existing.push(index + 2);
    rowsById.set(internalResponseId, existing);
  });

  return [...rowsById.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([internalResponseId, rowNumbers]) => ({ internalResponseId, rowNumbers }));
}

/**
 * Combines duplicate rows into one row. The first non-empty value wins, so
 * values that only exist on a duplicate row are preserved.
 */
export function mergeRowValues(rows: unknown[][]): string[] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const merged: string[] = [];

  for (let index = 0; index < width; index += 1) {
    const value = rows
      .map((row) => String(row[index] ?? ''))
      .find((candidate) => candidate.trim() !== '');

    merged.push(value ?? '');
  }

  return merged;
}
