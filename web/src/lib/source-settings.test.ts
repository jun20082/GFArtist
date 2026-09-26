import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { missingTabMessage, saveSourceSettings, type ValidatedSourceSettings } from './source-settings';
import { createOwnedWorkspace } from './workspace';
import { defaultColumnMapping } from './column-mapping';
import {
  addWorkspaceMember,
  createResponse,
  createSourceSettings,
  createUser,
  prisma,
  resetDatabase,
  seedDefaultCategories,
  TEST_USER_ID,
} from './test-db';

function buildSettings(
  overrides: Partial<ValidatedSourceSettings> = {},
): ValidatedSourceSettings {
  return {
    partyName: '테스트 파티',
    spreadsheetUrlOrId: 'sheet-1',
    spreadsheetId: 'sheet-1',
    responseSheetName: '설문지 응답',
    operatingStatusSheetName: '운영 상태',
    mapping: defaultColumnMapping,
    displayColumns: [],
    ...overrides,
  };
}

before(async () => {
  await resetDatabase();
  await seedDefaultCategories();
});

after(async () => {
  await prisma.$disconnect();
});

async function resetWithUsers(...userIds: string[]) {
  await resetDatabase();
  await seedDefaultCategories();

  for (const userId of userIds) {
    await createUser(userId);
  }
}

describe('missingTabMessage', () => {
  test('탭 이름 확인 안내와 사용 가능한 탭 목록을 포함한다', () => {
    const message = missingTabMessage('Response sheet tab not found', '설문지 응답', [
      '설문지 응답 시트1',
      '운영 상태',
    ]);

    assert.match(message, /Response sheet tab not found: 설문지 응답/);
    assert.match(message, /탭 이름을 확인해 주세요/);
    assert.match(message, /사용 가능한 탭: 설문지 응답 시트1, 운영 상태/);
  });

  test('탭이 하나도 없으면 (없음)으로 표시한다', () => {
    const message = missingTabMessage('Operating status tab not found', '운영 상태', []);

    assert.match(message, /Operating status tab not found: 운영 상태/);
    assert.match(message, /탭 이름을 확인해 주세요/);
    assert.match(message, /사용 가능한 탭: \(없음\)/);
  });
});

describe('saveSourceSettings', () => {
  test('워크스페이스가 없으면 저장을 거부한다', async () => {
    await resetWithUsers(TEST_USER_ID);

    await assert.rejects(
      () => saveSourceSettings(TEST_USER_ID, buildSettings()),
      /워크스페이스가 없습니다/,
    );
    assert.equal(await prisma.sourceSettings.count(), 0);
  });

  test('워크스페이스가 있으면 설정을 만든다', async () => {
    await resetWithUsers(TEST_USER_ID);
    const workspace = await createOwnedWorkspace(TEST_USER_ID, '테스트 파티');

    const saved = await saveSourceSettings(TEST_USER_ID, buildSettings());

    assert.equal(saved.spreadsheetId, 'sheet-1');
    assert.equal(saved.workspaceId, workspace.id);
    assert.equal(await prisma.sourceSettings.count(), 1);
    assert.equal(await prisma.workspace.count(), 1);

    const membership = await prisma.workspaceMember.findFirstOrThrow();

    assert.equal(membership.workspaceId, workspace.id);
    assert.equal(membership.userId, TEST_USER_ID);
    assert.equal(membership.role, 'OWNER');
  });

  test('설정을 저장하면 워크스페이스 이름이 파티명으로 바뀐다', async () => {
    await resetWithUsers(TEST_USER_ID);
    const workspace = await createOwnedWorkspace(TEST_USER_ID, '처음 이름');

    await saveSourceSettings(TEST_USER_ID, buildSettings({ partyName: '새 파티명' }));

    const refreshed = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
    assert.equal(refreshed.name, '새 파티명');
  });

  test('같은 워크스페이스에서 다시 저장해도 행이 늘지 않는다', async () => {
    await resetWithUsers(TEST_USER_ID);
    await createOwnedWorkspace(TEST_USER_ID, '테스트 파티');

    const first = await saveSourceSettings(TEST_USER_ID, buildSettings());
    const second = await saveSourceSettings(
      TEST_USER_ID,
      buildSettings({ partyName: '이름 변경', spreadsheetId: 'sheet-2' }),
    );

    assert.equal(await prisma.sourceSettings.count(), 1);
    assert.equal(await prisma.workspace.count(), 1);
    assert.equal(second.id, first.id);
    assert.equal(second.partyName, '이름 변경');
    assert.equal(second.spreadsheetId, 'sheet-2');
    assert.equal(second.workspaceId, first.workspaceId);
  });

  test('다시 저장해도 연결된 응답이 그대로 남는다', async () => {
    await resetWithUsers(TEST_USER_ID);
    await createOwnedWorkspace(TEST_USER_ID, '테스트 파티');

    const first = await saveSourceSettings(TEST_USER_ID, buildSettings());
    await createResponse(first.id, { name: '응답자', phoneRaw: '010-1111-2222' });

    const second = await saveSourceSettings(
      TEST_USER_ID,
      buildSettings({ partyName: '이름 변경', spreadsheetId: 'sheet-2' }),
    );

    assert.equal(second.id, first.id);
    assert.equal(await prisma.response.count({ where: { sourceSettingsId: first.id } }), 1);
  });

  test('다른 워크스페이스가 쓰는 스프레드시트는 거부한다', async () => {
    await resetWithUsers('user-1', 'user-2');
    await createOwnedWorkspace('user-1', 'A 파티');
    await createOwnedWorkspace('user-2', 'B 파티');

    await saveSourceSettings('user-1', buildSettings({ spreadsheetId: 'sheet-1' }));
    await saveSourceSettings('user-2', buildSettings({ spreadsheetId: 'sheet-2' }));

    await assert.rejects(
      () => saveSourceSettings('user-2', buildSettings({ spreadsheetId: 'sheet-1' })),
      /다른 워크스페이스에서 이미 사용 중/,
    );
  });

  test('운영자는 설정을 변경할 수 없다', async () => {
    await resetDatabase();
    await seedDefaultCategories();

    const settings = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(settings.workspaceId as string, 'user-2', 'OPERATOR');

    await assert.rejects(
      () => saveSourceSettings('user-2', buildSettings({ spreadsheetId: 'sheet-9' })),
      /소유자만 Sheets 설정을 변경할 수 있습니다/,
    );
  });

  test('워크스페이스마다 자기 스프레드시트를 가진다', async () => {
    await resetWithUsers('user-1', 'user-2');
    await createOwnedWorkspace('user-1', 'A 파티');
    await createOwnedWorkspace('user-2', 'B 파티');

    const first = await saveSourceSettings('user-1', buildSettings({ spreadsheetId: 'sheet-a' }));
    const second = await saveSourceSettings('user-2', buildSettings({ spreadsheetId: 'sheet-b' }));

    assert.notEqual(first.workspaceId, second.workspaceId);
    assert.equal(await prisma.sourceSettings.count(), 2);
    assert.equal(await prisma.workspace.count(), 2);
  });
});
