import { columnLetter, quoteSheetName } from '@/lib/sheet-format';
import { internalResponseIdHeader, type InternalIdPlan } from '@/lib/response-id';

/** Minimal Sheets surface so tests can pass a fake client. */
export type InternalIdSheetsClient = {
  spreadsheets: {
    values: {
      update: (params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: 'RAW';
        requestBody: { values: string[][] };
      }) => Promise<unknown>;
    };
  };
};

export type InternalIdWriteResult = {
  headerWritten: boolean;
  updatedRanges: number;
  generatedCount: number;
};

type Target = {
  spreadsheetId: string;
  responseSheetName: string;
};

/**
 * Groups consecutive row indexes so the id column is written with as few
 * requests as possible while touching only the rows that changed.
 */
export function groupRowRuns(indexes: number[]) {
  const runs: { start: number; end: number }[] = [];

  for (const index of [...indexes].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];

    if (last && index === last.end + 1) {
      last.end = index;
      continue;
    }

    runs.push({ start: index, end: index });
  }

  return runs;
}

/**
 * Writes the generated internal response ids to the response sheet. Only the
 * affected rows of the id column are touched; respondent fields are never
 * written.
 */
export async function writeInternalIds(
  userId: string,
  target: Target,
  plan: InternalIdPlan,
  sheetsClient?: InternalIdSheetsClient,
): Promise<InternalIdWriteResult> {
  if (plan.generatedCount === 0) {
    return { headerWritten: false, updatedRanges: 0, generatedCount: 0 };
  }

  let sheets = sheetsClient;

  if (!sheets) {
    const { getSheetsClient } = await import('@/lib/google-sheets');
    sheets = (await getSheetsClient(userId)) as unknown as InternalIdSheetsClient;
  }
  const prefix = quoteSheetName(target.responseSheetName);
  const column = columnLetter(plan.idIndex);
  let headerWritten = false;

  if (plan.headerAdded) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: target.spreadsheetId,
      range: `${prefix}!${column}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[internalResponseIdHeader]] },
    });
    headerWritten = true;
  }

  const runs = groupRowRuns(plan.generatedIndexes);

  for (const run of runs) {
    const values = plan.columnValues
      .slice(run.start, run.end + 1)
      .map((value) => [value]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: target.spreadsheetId,
      range: `${prefix}!${column}${run.start + 2}:${column}${run.end + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }

  return {
    headerWritten,
    updatedRanges: runs.length,
    generatedCount: plan.generatedCount,
  };
}
