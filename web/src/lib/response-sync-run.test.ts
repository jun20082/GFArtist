import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSyncAccess,
  runResponseSync,
  SYNC_OWNER_ONLY_MESSAGE,
  type ResponseSyncSheetsClient,
} from './response-sync-run';
import { getWorkspaceContext } from './workspace';
import {
  addWorkspaceMember,
  createSourceSettings,
  prisma,
  resetDatabase,
  seedDefaultCategories,
  TEST_USER_ID,
} from './test-db';

function columnIndex(letters: string) {
  let value = 0;

  for (const char of letters) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  return value - 1;
}

function applyUpdate(rows: string[][], range: string, values: string[][]) {
  const match = range.match(/!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);

  if (!match) {
    return;
  }

  const column = columnIndex(match[1]);
  const startRow = Number(match[2]);

  values.forEach((rowValues, offset) => {
    const rowIndex = startRow + offset - 1;

    while (rows.length <= rowIndex) {
      rows.push([]);
    }

    rowValues.forEach((value, cellOffset) => {
      const target = column + cellOffset;

      while (rows[rowIndex].length <= target) {
        rows[rowIndex].push('');
      }

      rows[rowIndex][target] = value;
    });
  });
}

function fakeSheet(initialRows: string[][], options: { delayMs?: number } = {}) {
  const rows = initialRows.map((row) => [...row]);
  const calls: { range: string; values: string[][] }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const enter = () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
  };

  const leave = () => {
    inFlight -= 1;
  };

  const client: ResponseSyncSheetsClient = {
    spreadsheets: {
      values: {
        get: async () => {
          enter();

          try {
            if (options.delayMs) {
              await new Promise((resolve) => setTimeout(resolve, options.delayMs));
            }

            return { data: { values: rows.map((row) => [...row]) } };
          } finally {
            leave();
          }
        },
        update: async (params) => {
          enter();

          try {
            calls.push({ range: params.range, values: params.requestBody.values });
            applyUpdate(rows, params.range, params.requestBody.values);
            return {};
          } finally {
            leave();
          }
        },
      },
    },
  };

  return { client, calls, rows, getMaxInFlight: () => maxInFlight };
}

function sequenceGenerator(prefix = 'resp_gen') {
  let counter = 0;

  return () => {
    counter += 1;
    return `${prefix}_${counter}`;
  };
}

async function setupOwnerWorkspace() {
  await resetDatabase();
  await seedDefaultCategories();

  const settings = await createSourceSettings({ userId: TEST_USER_ID });

  return settings;
}

describe('resolveSyncAccess', () => {
  test('워크스페이스가 없으면 400', () => {
    const access = resolveSyncAccess(null);

    assert.equal(access.ok, false);
    assert.equal(access.ok === false ? access.status : 0, 400);
  });

  test('시트 미연결이면 400', async () => {
    await resetDatabase();
    await seedDefaultCategories();
    await prisma.user.create({ data: { id: 'user-9', email: 'user-9@example.com' } });
    await prisma.workspace.create({
      data: { name: '빈 워크스페이스', ownerUserId: 'user-9', members: { create: { userId: 'user-9', role: 'OWNER' } } },
    });

    const access = resolveSyncAccess(await getWorkspaceContext('user-9'));

    assert.equal(access.ok, false);
    assert.equal(access.ok === false ? access.status : 0, 400);
  });

  test('운영자는 403 과 안내 문구', async () => {
    await resetDatabase();
    await seedDefaultCategories();
    const settings = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(settings.workspaceId as string, 'user-2', 'OPERATOR');

    const access = resolveSyncAccess(await getWorkspaceContext('user-2'));

    assert.equal(access.ok, false);
    assert.equal(access.ok === false ? access.status : 0, 403);
    assert.equal(access.ok === false ? access.error : '', SYNC_OWNER_ONLY_MESSAGE);
  });

  test('소유자는 통과하고 설정을 돌려준다', async () => {
    const settings = await setupOwnerWorkspace();
    const access = resolveSyncAccess(await getWorkspaceContext(TEST_USER_ID));

    assert.equal(access.ok, true);
    assert.equal(access.ok ? access.sourceSettings.id : '', settings.id);
  });
});

describe('runResponseSync', () => {
  test('빈 ID 를 생성하고 DB 에 반영한다', async () => {
    const settings = await setupOwnerWorkspace();
    const sheet = fakeSheet([
      ['이름', '전화번호', '성별', '주문 상품'],
      ['홍길동', '010-1111-2222', '남성', '상품A'],
      ['김철수', '010-3333-4444', '여성', '상품B'],
    ]);

    const result = await runResponseSync(TEST_USER_ID, settings, {
      sheets: sheet.client,
      generateId: sequenceGenerator(),
    });

    assert.equal(result.processedCount, 2);
    assert.equal(result.generatedCount, 2);

    const saved = await prisma.response.findMany({ orderBy: { name: 'asc' } });
    assert.deepEqual(saved.map((row) => row.internalResponseId), ['resp_gen_2', 'resp_gen_1']);
    assert.deepEqual(sheet.rows[0], ['이름', '전화번호', '성별', '주문 상품', '_internal_response_id']);
  });

  test('기존 ID 는 유지하고 DB 행이 중복되지 않는다', async () => {
    const settings = await setupOwnerWorkspace();
    const sheet = fakeSheet([
      ['이름', '전화번호', '성별', '주문 상품', '_internal_response_id'],
      ['홍길동', '010-1111-2222', '남성', '상품A', 'resp_existing'],
      ['김철수', '010-3333-4444', '여성', '상품B', ''],
    ]);

    const result = await runResponseSync(TEST_USER_ID, settings, {
      sheets: sheet.client,
      generateId: sequenceGenerator(),
    });

    assert.equal(result.generatedCount, 1);

    const saved = await prisma.response.findMany({ orderBy: { name: 'asc' } });
    assert.deepEqual(saved.map((row) => row.internalResponseId), ['resp_gen_1', 'resp_existing']);
  });

  test('동시 동기화는 직렬화되어 ID 를 한 번만 생성한다', async () => {
    const settings = await setupOwnerWorkspace();
    const sheet = fakeSheet(
      [
        ['이름', '전화번호', '성별', '주문 상품'],
        ['홍길동', '010-1111-2222', '남성', '상품A'],
      ],
      { delayMs: 60 },
    );

    const results = await Promise.all([
      runResponseSync(TEST_USER_ID, settings, { sheets: sheet.client, generateId: sequenceGenerator('a') }),
      runResponseSync(TEST_USER_ID, settings, { sheets: sheet.client, generateId: sequenceGenerator('b') }),
    ]);

    const totalGenerated = results.reduce((sum, result) => sum + result.generatedCount, 0);

    assert.equal(totalGenerated, 1);
    assert.equal(sheet.getMaxInFlight(), 1);

    const count = await prisma.response.count({ where: { sourceSettingsId: settings.id } });
    assert.equal(count, 1);
  });

  test('이름과 전화번호가 모두 빈 행은 반영하지 않는다', async () => {
    const settings = await setupOwnerWorkspace();
    const sheet = fakeSheet([
      ['이름', '전화번호', '성별', '주문 상품', '_internal_response_id'],
      ['', '', '', '', ''],
      ['홍길동', '010-1111-2222', '남성', '상품A', ''],
    ]);

    const result = await runResponseSync(TEST_USER_ID, settings, {
      sheets: sheet.client,
      generateId: sequenceGenerator(),
    });

    assert.equal(result.processedCount, 1);
    assert.equal(await prisma.response.count(), 1);
  });
});

after(async () => {
  await prisma.$disconnect();
});
