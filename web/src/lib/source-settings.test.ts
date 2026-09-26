import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { missingTabMessage, saveSourceSettings, toPublicSourceSettings, type ValidatedSourceSettings } from './source-settings';
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
  test('처음 저장하면 워크스페이스와 설정을 함께 만든다', async () => {
    await resetWithUsers(TEST_USER_ID);

    const saved = await saveSourceSettings(TEST_USER_ID, buildSettings());

    assert.equal(saved.isActive, true);
    assert.equal(saved.spreadsheetId, 'sheet-1');
    assert.equal(await prisma.sourceSettings.count(), 1);
    assert.equal(await prisma.workspace.count(), 1);

    const workspace = await prisma.workspace.findFirstOrThrow();
    const membership = await prisma.workspaceMember.findFirstOrThrow();

    assert.equal(saved.workspaceId, workspace.id);
    assert.equal(membership.workspaceId, workspace.id);
    assert.equal(membership.userId, TEST_USER_ID);
    assert.equal(membership.role, 'OWNER');
  });

  test('같은 워크스페이스에서 다시 저장해도 행이 늘지 않는다', async () => {
    await resetWithUsers(TEST_USER_ID);

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

    const first = await saveSourceSettings('user-1', buildSettings({ spreadsheetId: 'sheet-a' }));
    const second = await saveSourceSettings('user-2', buildSettings({ spreadsheetId: 'sheet-b' }));

    assert.notEqual(first.workspaceId, second.workspaceId);
    assert.equal(await prisma.sourceSettings.count(), 2);
    assert.equal(await prisma.workspace.count(), 2);
  });

  test('Apps Script Secret을 암호화해 저장하고 평문을 남기지 않는다', async () => {
    await resetWithUsers(TEST_USER_ID);
    process.env.APP_ENCRYPTION_KEY = 'a'.repeat(64);

    try {
      const saved = await saveSourceSettings(
        TEST_USER_ID,
        buildSettings({
          appsScriptUrl: 'https://script.google.com/macros/s/example/exec',
          appsScriptSecret: 'plain-secret',
        }),
      );

      assert.equal(saved.appsScriptUrl, 'https://script.google.com/macros/s/example/exec');
      assert.notEqual(saved.appsScriptSecretEncrypted, 'plain-secret');
      assert.match(String(saved.appsScriptSecretEncrypted), /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

      const publicView = toPublicSourceSettings(saved);
      assert.equal('appsScriptSecretEncrypted' in publicView, false);
      assert.equal(publicView.hasAppsScriptSecret, true);
    } finally {
      delete process.env.APP_ENCRYPTION_KEY;
    }
  });

  test('Secret을 비워 두면 기존 저장값을 유지한다', async () => {
    await resetWithUsers(TEST_USER_ID);
    process.env.APP_ENCRYPTION_KEY = 'a'.repeat(64);

    try {
      const first = await saveSourceSettings(
        TEST_USER_ID,
        buildSettings({ appsScriptSecret: 'plain-secret' }),
      );
      const second = await saveSourceSettings(
        TEST_USER_ID,
        buildSettings({ spreadsheetId: 'sheet-2' }),
      );

      assert.equal(second.appsScriptSecretEncrypted, first.appsScriptSecretEncrypted);
    } finally {
      delete process.env.APP_ENCRYPTION_KEY;
    }
  });

  test('APP_ENCRYPTION_KEY 없이 Secret을 저장하면 안내 오류를 던진다', async () => {
    await resetWithUsers(TEST_USER_ID);
    delete process.env.APP_ENCRYPTION_KEY;

    await assert.rejects(
      () => saveSourceSettings(TEST_USER_ID, buildSettings({ appsScriptSecret: 'plain' })),
      /APP_ENCRYPTION_KEY is not configured/,
    );
  });
});
