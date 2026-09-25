import { prisma } from '@/lib/prisma';
import { invalidateSourceSettingsCache } from '@/lib/source-settings';

export { prisma };

export const TEST_USER_ID = 'user-1';

export async function resetDatabase() {
  invalidateSourceSettingsCache();

  await prisma.workspaceMember.deleteMany();
  await prisma.response.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.sourceSettings.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
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

export async function createUser(userId: string = TEST_USER_ID) {
  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: `${userId}@example.com` },
    update: {},
  });
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'OWNER' | 'OPERATOR' = 'OPERATOR',
) {
  await createUser(userId);

  return prisma.workspaceMember.create({
    data: { workspaceId, userId, role },
  });
}

/**
 * Creates an owner user, a workspace and the workspace source settings so the
 * tests exercise the same shape as production.
 */
export async function createSourceSettings(
  overrides: { partyName?: string; userId?: string } = {},
) {
  const userId = overrides.userId ?? TEST_USER_ID;
  const partyName = overrides.partyName ?? '테스트 파티';

  await createUser(userId);

  const workspace = await prisma.workspace.create({
    data: {
      name: partyName,
      ownerUserId: userId,
      members: { create: { userId, role: 'OWNER' } },
    },
  });

  return prisma.sourceSettings.create({
    data: {
      workspaceId: workspace.id,
      partyName,
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
