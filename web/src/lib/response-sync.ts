import type { PrismaClient } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

export type ResponseRow = {
  internalResponseId: string;
  name: string;
  phoneRaw: string;
  gender: string;
  orderedProduct: string;
  sourceRowNumber: number;
};

/** The delegates needed to upsert responses, so a transaction client also fits. */
export type ResponseSyncDb = Pick<PrismaClient, 'response' | 'sourceSettings'>;

/**
 * Upserts source Sheet rows by internal response id using the given database
 * handle. Callers that already hold a transaction (for the workspace lock) must
 * use this variant to stay on the same connection.
 */
export async function applyResponseRowsInDb(
  db: ResponseSyncDb,
  sourceSettingsId: string,
  rows: ResponseRow[],
) {
  const syncedAt = new Date();

  for (const row of rows) {
    const phoneNormalized = normalizePhone(row.phoneRaw);

    await db.response.upsert({
      where: { internalResponseId: row.internalResponseId },
      create: {
        sourceSettingsId,
        internalResponseId: row.internalResponseId,
        name: row.name,
        phoneRaw: row.phoneRaw,
        phoneNormalized,
        gender: row.gender,
        orderedProduct: row.orderedProduct,
        sourceRowNumber: row.sourceRowNumber,
        lastResponseSyncAt: syncedAt,
      },
      update: {
        sourceSettingsId,
        name: row.name,
        phoneRaw: row.phoneRaw,
        phoneNormalized,
        gender: row.gender,
        orderedProduct: row.orderedProduct,
        sourceRowNumber: row.sourceRowNumber,
        lastResponseSyncAt: syncedAt,
      },
    });
  }

  await db.sourceSettings.update({
    where: { id: sourceSettingsId },
    data: { lastResponseSyncAt: syncedAt },
  });

  return rows.length;
}

/**
 * Upserts source Sheet rows by internal response id. Operating status fields
 * (category, entry, product) are never written here, so manager edits survive
 * every response sync. Rows missing from the Sheet are left untouched.
 */
export async function applyResponseRows(sourceSettingsId: string, rows: ResponseRow[]) {
  return prisma.$transaction((tx) => applyResponseRowsInDb(tx, sourceSettingsId, rows));
}
