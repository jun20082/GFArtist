import { prisma } from '@/lib/prisma';

export { prisma };

export async function resetDatabase() {
  await prisma.response.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.sourceSettings.deleteMany();
  await prisma.category.deleteMany();
}

export async function seedDefaultCategories() {
  await prisma.category.createMany({
    data: [
      { code: 'UNPAID', name: '입금 안 함', color: '#94a3b8', sortOrder: 1 },
      { code: 'PAYMENT_CONFIRMED', name: '입금 확인', color: '#facc15', sortOrder: 2 },
      { code: 'MESSAGE_SENT', name: '문자 발송 완료', color: '#4ade80', sortOrder: 3 },
    ],
    skipDuplicates: true,
  });
}

export async function createSourceSettings(overrides: Partial<{ partyName: string }> = {}) {
  return prisma.sourceSettings.create({
    data: {
      partyName: overrides.partyName ?? '테스트 파티',
      spreadsheetId: `test-sheet-${Math.random().toString(36).slice(2, 10)}`,
      responseSheetName: '설문지 응답',
      operatingStatusSheetName: '운영 상태',
      isActive: true,
    },
  });
}

type SeedResponseInput = {
  name: string;
  phoneRaw: string;
  gender?: string;
  orderedProduct?: string;
  entryStatus?: 'NOT_ENTERED' | 'ENTERED';
  productStatus?: 'NOT_RECEIVED' | 'RECEIVED';
  categoryCode?: 'UNPAID' | 'PAYMENT_CONFIRMED' | 'MESSAGE_SENT';
};

let responseSequence = 0;

export async function createResponse(sourceSettingsId: string, input: SeedResponseInput) {
  responseSequence += 1;

  return prisma.response.create({
    data: {
      sourceSettingsId,
      internalResponseId: `resp_test_${responseSequence}`,
      name: input.name,
      phoneRaw: input.phoneRaw,
      phoneNormalized: input.phoneRaw.replace(/\D/g, ''),
      gender: input.gender ?? '남성',
      orderedProduct: input.orderedProduct ?? '상품1',
      entryStatus: input.entryStatus ?? 'NOT_ENTERED',
      productStatus: input.productStatus ?? 'NOT_RECEIVED',
      categoryCode: input.categoryCode ?? 'UNPAID',
      sourceRowNumber: responseSequence + 1,
    },
  });
}
