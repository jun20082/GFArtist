import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ResponseNotFoundError, updateResponseStatus } from './response-status';
import {
  createResponse,
  createSourceSettings,
  prisma,
  resetDatabase,
  seedDefaultCategories,
} from './test-db';

async function setup() {
  await resetDatabase();
  await seedDefaultCategories();
  const settings = await createSourceSettings();
  const response = await createResponse(settings.id, {
    name: '상태 변경',
    phoneRaw: '010-5555-6666',
  });

  return { settings, response };
}

describe('updateResponseStatus 상태 변경', () => {
  test('카테고리를 변경한다', async () => {
    const { response } = await setup();

    const updated = await updateResponseStatus(response.id, { categoryCode: 'MESSAGE_SENT' });

    assert.equal(updated.categoryCode, 'MESSAGE_SENT');
    assert.equal(updated.category.code, 'MESSAGE_SENT');
  });

  test('입장 여부를 변경한다', async () => {
    const { response } = await setup();

    const updated = await updateResponseStatus(response.id, { entryStatus: 'ENTERED' });

    assert.equal(updated.entryStatus, 'ENTERED');
  });

  test('상품 수령 여부를 변경한다', async () => {
    const { response } = await setup();

    const updated = await updateResponseStatus(response.id, { productStatus: 'RECEIVED' });

    assert.equal(updated.productStatus, 'RECEIVED');
  });

  test('변경하면 동기화 대기 상태가 되고 이전 오류를 지운다', async () => {
    const { response } = await setup();
    await prisma.response.update({
      where: { id: response.id },
      data: { statusSyncState: 'FAILED', lastStatusSyncError: '이전 실패' },
    });

    const updated = await updateResponseStatus(response.id, { entryStatus: 'ENTERED' });

    assert.equal(updated.statusSyncState, 'PENDING');
    assert.equal(updated.lastStatusSyncError, null);
  });

  test('없는 응답이면 ResponseNotFoundError를 던진다', async () => {
    await setup();

    await assert.rejects(
      () => updateResponseStatus('missing-response-id', { entryStatus: 'ENTERED' }),
      ResponseNotFoundError,
    );
  });
});

after(async () => {
  await prisma.$disconnect();
});
