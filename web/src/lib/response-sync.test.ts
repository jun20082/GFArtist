import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyResponseRows, type ResponseRow } from './response-sync';
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
  return createSourceSettings();
}

function buildRow(overrides: Partial<ResponseRow> = {}): ResponseRow {
  return {
    internalResponseId: 'resp_sync_1',
    name: '동기화 대상',
    phoneRaw: '010-1111-2222',
    gender: '여성',
    orderedProduct: '상품A',
    extraFields: {},
    sourceRowNumber: 2,
    ...overrides,
  };
}

describe('applyResponseRows 응답 동기화', () => {
  test('신규 응답을 추가한다', async () => {
    const settings = await setup();

    const processed = await applyResponseRows(settings.id, [buildRow()]);
    assert.equal(processed, 1);

    const saved = await prisma.response.findUniqueOrThrow({
      where: { internalResponseId: 'resp_sync_1' },
    });
    assert.equal(saved.name, '동기화 대상');
    assert.equal(saved.phoneNormalized, '01011112222');
    assert.equal(saved.sourceSettingsId, settings.id);
  });

  test('추가 표시 컬럼 값을 저장한다', async () => {
    const settings = await setup();

    await applyResponseRows(settings.id, [
      buildRow({ extraFields: { 비고: '선물', 타임스탬프: '2026-09-27' } }),
    ]);

    const saved = await prisma.response.findUniqueOrThrow({
      where: { internalResponseId: 'resp_sync_1' },
    });
    assert.deepEqual(saved.extraFields, { 비고: '선물', 타임스탬프: '2026-09-27' });
  });

  test('같은 내부 ID는 행을 늘리지 않고 원본 필드만 갱신한다', async () => {
    const settings = await setup();

    await applyResponseRows(settings.id, [buildRow()]);
    await applyResponseRows(settings.id, [buildRow({ name: '이름 변경', sourceRowNumber: 5 })]);

    assert.equal(await prisma.response.count(), 1);
    const saved = await prisma.response.findUniqueOrThrow({
      where: { internalResponseId: 'resp_sync_1' },
    });
    assert.equal(saved.name, '이름 변경');
    assert.equal(saved.sourceRowNumber, 5);
  });

  test('동기화해도 카테고리·입장·상품 상태를 유지한다', async () => {
    const settings = await setup();
    const created = await createResponse(settings.id, {
      name: '상태 보존',
      phoneRaw: '010-2222-3333',
      categoryCode: 'PAYMENT_CONFIRMED',
      entryStatus: 'ENTERED',
      productStatus: 'RECEIVED',
    });

    await applyResponseRows(settings.id, [
      buildRow({ internalResponseId: created.internalResponseId, name: '상태 보존 갱신' }),
    ]);

    const saved = await prisma.response.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(saved.name, '상태 보존 갱신');
    assert.equal(saved.categoryCode, 'PAYMENT_CONFIRMED');
    assert.equal(saved.entryStatus, 'ENTERED');
    assert.equal(saved.productStatus, 'RECEIVED');
  });

  test('시트에서 사라진 응답은 삭제하지 않는다', async () => {
    const settings = await setup();
    const inSheet = await createResponse(settings.id, {
      name: '시트에 있음',
      phoneRaw: '010-3333-4444',
    });
    const missingFromSheet = await createResponse(settings.id, {
      name: '시트에서 삭제됨',
      phoneRaw: '010-4444-5555',
    });

    await applyResponseRows(settings.id, [
      buildRow({ internalResponseId: inSheet.internalResponseId, name: '시트에 있음' }),
    ]);

    assert.equal(await prisma.response.count(), 2);
    assert.ok(await prisma.response.findUnique({ where: { id: missingFromSheet.id } }));
  });

  test('SourceSettings.lastResponseSyncAt을 갱신한다', async () => {
    const settings = await setup();
    assert.equal(settings.lastResponseSyncAt, null);

    await applyResponseRows(settings.id, [buildRow()]);

    const refreshed = await prisma.sourceSettings.findUniqueOrThrow({ where: { id: settings.id } });
    assert.ok(refreshed.lastResponseSyncAt instanceof Date);
  });
});

after(async () => {
  await prisma.$disconnect();
});
