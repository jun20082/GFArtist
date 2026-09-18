import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperatingStatusRow,
  buildOperatingStatusValues,
  findOperatingStatusRowIndex,
  retryPendingStatusSync,
  syncResponseStatus,
  type OperatingStatusWriter,
  type ResponseForSync,
} from './operating-status';
import { prisma, resetDatabase, seedDefaultCategories, createSourceSettings, createResponse } from './test-db';

const sample: ResponseForSync = {
  id: 'row-1',
  internalResponseId: 'resp_test_1',
  name: '허준범',
  phoneRaw: '010-5801-5539',
  entryStatus: 'ENTERED',
  productStatus: 'NOT_RECEIVED',
};

describe('운영 상태 순수 함수', () => {
  test('buildOperatingStatusValues가 한국어 라벨로 변환한다', () => {
    const values = buildOperatingStatusValues(sample);
    assert.equal(values.get('_internal_response_id'), 'resp_test_1');
    assert.equal(values.get('이름'), '허준범');
    assert.equal(values.get('전화번호'), '010-5801-5539');
    assert.equal(values.get('입장 여부'), '입장 완료');
    assert.equal(values.get('상품 수령 여부'), '미수령');
  });

  test('buildOperatingStatusRow가 관리 대상 컬럼만 덮어쓴다', () => {
    const headers = ['_internal_response_id', '이름', '비고', '입장 여부', '상품 수령 여부'];
    const row = buildOperatingStatusRow(headers, ['old-id', 'old-name', '수동 메모'], buildOperatingStatusValues(sample));
    assert.deepEqual(row, ['resp_test_1', '허준범', '수동 메모', '입장 완료', '미수령']);
  });

  test('buildOperatingStatusRow가 빈 행에서도 안전하다', () => {
    const headers = ['_internal_response_id', '이름', '비고', '입장 여부', '상품 수령 여부'];
    const row = buildOperatingStatusRow(headers, [], buildOperatingStatusValues(sample));
    assert.deepEqual(row, ['resp_test_1', '허준범', '', '입장 완료', '미수령']);
  });

  test('findOperatingStatusRowIndex가 ID로 행을 찾는다', () => {
    const rows = [['resp_a'], ['resp_b'], ['resp_c']];
    assert.equal(findOperatingStatusRowIndex(rows, 0, 'resp_b'), 1);
  });

  test('findOperatingStatusRowIndex가 공백을 무시한다', () => {
    const rows = [['  resp_b  ']];
    assert.equal(findOperatingStatusRowIndex(rows, 0, 'resp_b'), 0);
  });

  test('findOperatingStatusRowIndex가 없으면 -1을 돌려준다', () => {
    const rows = [['resp_a']];
    assert.equal(findOperatingStatusRowIndex(rows, 0, 'resp_z'), -1);
  });
});

describe('syncResponseStatus 상태 전이', () => {
  let sourceSettingsId = '';

  before(async () => {
    await resetDatabase();
    await seedDefaultCategories();
    const settings = await createSourceSettings();
    sourceSettingsId = settings.id;
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('성공하면 SYNCED와 동기화 시간을 저장한다', async () => {
    const response = await createResponse(sourceSettingsId, {
      name: '성공자',
      phoneRaw: '010-1111-2222',
      entryStatus: 'ENTERED',
      productStatus: 'RECEIVED',
    });
    const writer: OperatingStatusWriter = async () => ({ action: 'updated', rowNumber: 2 });

    const result = await syncResponseStatus('user-1', response.id, writer);
    assert.deepEqual(result, { action: 'updated', rowNumber: 2 });

    const saved = await prisma.response.findUniqueOrThrow({ where: { id: response.id } });
    assert.equal(saved.statusSyncState, 'SYNCED');
    assert.equal(saved.lastStatusSyncError, null);
    assert.ok(saved.lastStatusSyncAt);
  });

  test('실행 시점의 최신 DB 값을 writer에게 넘긴다', async () => {
    const response = await createResponse(sourceSettingsId, {
      name: '최신값',
      phoneRaw: '010-7777-8888',
      entryStatus: 'NOT_ENTERED',
      productStatus: 'NOT_RECEIVED',
    });

    await prisma.response.update({
      where: { id: response.id },
      data: { entryStatus: 'ENTERED', productStatus: 'RECEIVED' },
    });

    const captured: ResponseForSync[] = [];
    const writer: OperatingStatusWriter = async (_userId, _settings, received) => {
      captured.push(received);
      return { action: 'updated', rowNumber: 2 };
    };

    await syncResponseStatus('user-1', response.id, writer);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].entryStatus, 'ENTERED');
    assert.equal(captured[0].productStatus, 'RECEIVED');
  });

  test('실패해도 DB 상태와 입장·상품 값을 보존한다', async () => {
    const response = await createResponse(sourceSettingsId, {
      name: '실패자',
      phoneRaw: '010-3333-4444',
      entryStatus: 'ENTERED',
      productStatus: 'NOT_RECEIVED',
    });
    const writer: OperatingStatusWriter = async () => {
      throw new Error('Sheet write failed.');
    };

    await assert.rejects(() => syncResponseStatus('user-1', response.id, writer), /Sheet write failed/);

    const saved = await prisma.response.findUniqueOrThrow({ where: { id: response.id } });
    assert.equal(saved.statusSyncState, 'FAILED');
    assert.equal(saved.lastStatusSyncError, 'Sheet write failed.');
    assert.equal(saved.entryStatus, 'ENTERED');
    assert.equal(saved.productStatus, 'NOT_RECEIVED');
  });
});

describe('retryPendingStatusSync 재시도', () => {
  let sourceSettingsId = '';

  before(async () => {
    await resetDatabase();
    await seedDefaultCategories();
    const settings = await createSourceSettings();
    sourceSettingsId = settings.id;
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('대기·실패 건만 재시도하고 성공·실패를 집계한다', async () => {
    const pendingA = await createResponse(sourceSettingsId, { name: '대기A', phoneRaw: '010-0001' });
    const pendingB = await createResponse(sourceSettingsId, { name: '대기B', phoneRaw: '010-0002' });
    const failedC = await createResponse(sourceSettingsId, { name: '실패C', phoneRaw: '010-0003' });
    const alreadySynced = await createResponse(sourceSettingsId, { name: '완료D', phoneRaw: '010-0004' });

    await prisma.response.updateMany({
      where: { id: { in: [pendingA.id, pendingB.id] } },
      data: { statusSyncState: 'PENDING' },
    });
    await prisma.response.update({
      where: { id: failedC.id },
      data: { statusSyncState: 'FAILED' },
    });
    await prisma.response.update({
      where: { id: alreadySynced.id },
      data: { statusSyncState: 'SYNCED' },
    });

    const writer: OperatingStatusWriter = async (_userId, _settings, response) => {
      if (response.name === '실패C') {
        throw new Error('retry failed.');
      }
      return { action: 'appended' };
    };

    const result = await retryPendingStatusSync('user-1', writer);
    assert.equal(result.total, 3);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 1);

    const refreshed = await prisma.response.findMany({
      where: { id: { in: [pendingA.id, pendingB.id, failedC.id, alreadySynced.id] } },
    });
    const stateByName = new Map(refreshed.map((row) => [row.name, row.statusSyncState]));
    assert.equal(stateByName.get('대기A'), 'SYNCED');
    assert.equal(stateByName.get('대기B'), 'SYNCED');
    assert.equal(stateByName.get('실패C'), 'FAILED');
    assert.equal(stateByName.get('완료D'), 'SYNCED');
  });
});
