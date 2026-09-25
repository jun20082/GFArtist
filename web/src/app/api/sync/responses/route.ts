import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ensureAppsScriptIds,
  getSheetsClient,
  quoteSheetName,
} from '@/lib/google-sheets';
import { getWorkspaceSourceSettings } from '@/lib/source-settings';
import { applyResponseRows } from '@/lib/response-sync';
import { assertMappingPresent } from '@/lib/column-mapping';

function asText(value: unknown) {
  return String(value ?? '').trim();
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const sourceSettings = await getWorkspaceSourceSettings(userId);

  if (!sourceSettings) {
    return NextResponse.json({ error: 'Active source settings are missing.' }, { status: 400 });
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      sourceSettingsId: sourceSettings.id,
      kind: 'responses',
    },
  });

  try {
    await ensureAppsScriptIds(sourceSettings);
    const sheets = await getSheetsClient(userId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sourceSettings.spreadsheetId,
      range: `${quoteSheetName(sourceSettings.responseSheetName)}!A:Z`,
    });
    const rows = response.data.values ?? [];
    const headers = (rows[0] ?? []).map((value) => asText(value));
    const mapping = {
      nameHeader: sourceSettings.nameHeader,
      phoneHeader: sourceSettings.phoneHeader,
      genderHeader: sourceSettings.genderHeader,
      orderedProductHeader: sourceSettings.orderedProductHeader,
      internalResponseIdHeader: sourceSettings.internalResponseIdHeader,
    };

    assertMappingPresent(headers, mapping);

    const indexes = new Map(headers.map((header, index) => [header, index]));

    const responseRows = rows
      .slice(1)
      .map((row, index) => ({
        name: asText(row[indexes.get(mapping.nameHeader) ?? -1]),
        phoneRaw: asText(row[indexes.get(mapping.phoneHeader) ?? -1]),
        gender: asText(row[indexes.get(mapping.genderHeader) ?? -1]),
        orderedProduct: asText(row[indexes.get(mapping.orderedProductHeader) ?? -1]),
        internalResponseId: asText(row[indexes.get(mapping.internalResponseIdHeader) ?? -1]),
        sourceRowNumber: index + 2,
      }))
      .filter((row) => row.internalResponseId && (row.name || row.phoneRaw));

    const processedCount = await applyResponseRows(sourceSettings.id, responseRows);

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        success: true,
        finishedAt: new Date(),
        processedCount,
      },
    });

    return NextResponse.json({ ok: true, processedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Response sync failed.';
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
