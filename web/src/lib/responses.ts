import { prisma } from '@/lib/prisma';
import type { EntryStatus, ProductStatus } from '@/generated/prisma/enums';
import { normalizePhone } from '@/lib/phone';

export { normalizePhone };

export type ResponseSearchInput = {
  query: string;
  entryStatus?: EntryStatus;
  productStatus?: ProductStatus;
};

export async function searchResponses(sourceSettingsId: string, input: ResponseSearchInput) {
  const query = input.query.trim();
  const phoneDigits = normalizePhone(query);

  return prisma.response.findMany({
    where: {
      sourceSettingsId,
      entryStatus: input.entryStatus,
      productStatus: input.productStatus,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              ...(phoneDigits ? [{ phoneNormalized: { contains: phoneDigits } }] : []),
            ],
          }
        : {}),
    },
    include: { category: true },
    orderBy: [{ name: 'asc' }, { sourceRowNumber: 'asc' }],
  });
}
