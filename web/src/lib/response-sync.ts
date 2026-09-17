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

/**
 * Upserts source Sheet rows by internal response id. Operating status fields
 * (category, entry, product) are never written here, so manager edits survive
 * every response sync. Rows missing from the Sheet are left untouched.
 */
export async function applyResponseRows(sourceSettingsId: string, rows: ResponseRow[]) {
  const syncedAt = new Date();

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const phoneNormalized = normalizePhone(row.phoneRaw);

      await tx.response.upsert({
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

    await tx.sourceSettings.update({
      where: { id: sourceSettingsId },
      data: { lastResponseSyncAt: syncedAt },
    });
  });

  return rows.length;
}
