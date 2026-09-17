import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ensureAppsScriptIds,
  getSheetsClient,
  quoteSheetName,
} from '@/lib/google-sheets';
import { getActiveSourceSettings, requiredResponseHeaders } from '@/lib/source-settings';

function asText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sourceSettings = await getActiveSourceSettings();

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
    await ensureAppsScriptIds();
    const sheets = await getSheetsClient(session.user.id);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sourceSettings.spreadsheetId,
      range: `${quoteSheetName(sourceSettings.responseSheetName)}!A:Z`,
    });
    const rows = response.data.values ?? [];
    const headers = (rows[0] ?? []).map((value) => asText(value));
    const indexes = new Map(headers.map((header, index) => [header, index]));
    const missingHeaders = requiredResponseHeaders.filter((header) => !indexes.has(header));

    if (missingHeaders.length > 0) {
      throw new Error(`Missing response headers: ${missingHeaders.join(', ')}`);
    }

    const responses = rows.slice(1)
      .map((row, index) => ({
        name: asText(row[indexes.get('이름') ?? -1]),
        phoneRaw: asText(row[indexes.get('전화번호') ?? -1]),
        gender: asText(row[indexes.get('성별') ?? -1]),
        orderedProduct: asText(row[indexes.get('주문 상품') ?? -1]),
        internalResponseId: asText(row[indexes.get('_internal_response_id') ?? -1]),
        sourceRowNumber: index + 2,
      }))
      .filter((row) => row.internalResponseId && (row.name || row.phoneRaw));

    await prisma.$transaction(async (tx) => {
      for (const response of responses) {
        await tx.response.upsert({
          where: { internalResponseId: response.internalResponseId },
          create: {
            sourceSettingsId: sourceSettings.id,
            internalResponseId: response.internalResponseId,
            name: response.name,
            phoneRaw: response.phoneRaw,
            phoneNormalized: normalizePhone(response.phoneRaw),
            gender: response.gender,
            orderedProduct: response.orderedProduct,
            sourceRowNumber: response.sourceRowNumber,
            lastResponseSyncAt: new Date(),
          },
          update: {
            sourceSettingsId: sourceSettings.id,
            name: response.name,
            phoneRaw: response.phoneRaw,
            phoneNormalized: normalizePhone(response.phoneRaw),
            gender: response.gender,
            orderedProduct: response.orderedProduct,
            sourceRowNumber: response.sourceRowNumber,
            lastResponseSyncAt: new Date(),
          },
        });
      }

      await tx.sourceSettings.update({
        where: { id: sourceSettings.id },
        data: { lastResponseSyncAt: new Date() },
      });

      await tx.syncRun.update({
        where: { id: syncRun.id },
        data: {
          success: true,
          finishedAt: new Date(),
          processedCount: responses.length,
        },
      });
    });

    return NextResponse.json({ ok: true, processedCount: responses.length });
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
