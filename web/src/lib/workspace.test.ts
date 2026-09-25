import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getResponseForMember,
  getWorkspaceContext,
  isWorkspaceMember,
  isWorkspaceOwner,
} from './workspace';
import { getWorkspaceSourceSettings } from './source-settings';
import { retryPendingStatusSync, type OperatingStatusWriter } from './operating-status';
import {
  addWorkspaceMember,
  createResponse,
  createSourceSettings,
  prisma,
  resetDatabase,
  seedDefaultCategories,
} from './test-db';

async function setup() {
  await resetDatabase();
  await seedDefaultCategories();
}

describe('워크스페이스 격리', () => {
  test('멤버는 자기 워크스페이스 설정만 본다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    const second = await createSourceSettings({ userId: 'user-2', partyName: 'B 파티' });

    const firstSettings = await getWorkspaceSourceSettings('user-1');
    const secondSettings = await getWorkspaceSourceSettings('user-2');

    assert.equal(firstSettings?.id, first.id);
    assert.equal(secondSettings?.id, second.id);
    assert.notEqual(firstSettings?.id, secondSettings?.id);
  });

  test('멤버가 아니면 워크스페이스 컨텍스트가 없다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });

    assert.equal(await getWorkspaceContext('user-3'), null);
    assert.equal(await getWorkspaceSourceSettings('user-3'), null);
  });

  test('같은 워크스페이스 멤버는 같은 설정을 본다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(settings.workspaceId as string, 'user-2', 'OPERATOR');

    const firstSettings = await getWorkspaceSourceSettings('user-1');
    const secondSettings = await getWorkspaceSourceSettings('user-2');

    assert.equal(firstSettings?.id, settings.id);
    assert.equal(secondSettings?.id, settings.id);
  });

  test('멤버십과 소유자 역할을 구분한다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(settings.workspaceId as string, 'user-2', 'OPERATOR');

    assert.equal(await isWorkspaceMember('user-2', settings.workspaceId), true);
    assert.equal(await isWorkspaceOwner('user-2', settings.workspaceId), false);
    assert.equal(await isWorkspaceOwner('user-1', settings.workspaceId), true);
    assert.equal(await isWorkspaceMember('user-3', settings.workspaceId), false);
    assert.equal(await isWorkspaceMember('user-1', null), false);
  });

  test('응답 조회는 워크스페이스 멤버만 가능하다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    await createSourceSettings({ userId: 'user-2', partyName: 'B 파티' });
    const response = await createResponse(first.id, { name: 'A 응답자', phoneRaw: '010-1111' });

    const allowed = await getResponseForMember('user-1', response.id);
    const denied = await getResponseForMember('user-2', response.id);

    assert.equal(allowed?.id, response.id);
    assert.equal(denied, null);
  });

  test('재시도는 자기 워크스페이스의 대기 건만 처리한다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    const second = await createSourceSettings({ userId: 'user-2', partyName: 'B 파티' });
    const firstResponse = await createResponse(first.id, { name: 'A 응답자', phoneRaw: '010-1111' });
    const secondResponse = await createResponse(second.id, { name: 'B 응답자', phoneRaw: '010-2222' });

    const synced: string[] = [];
    const writer: OperatingStatusWriter = async (_userId, _settings, response) => {
      synced.push(response.name);
      return { action: 'updated', rowNumber: 2 };
    };

    const result = await retryPendingStatusSync('user-1', writer);

    assert.equal(result.total, 1);
    assert.equal(result.succeeded, 1);
    assert.deepEqual(synced, ['A 응답자']);

    const untouched = await prisma.response.findUniqueOrThrow({ where: { id: secondResponse.id } });
    assert.equal(untouched.statusSyncState, 'PENDING');

    const touched = await prisma.response.findUniqueOrThrow({ where: { id: firstResponse.id } });
    assert.equal(touched.statusSyncState, 'SYNCED');
  });
});

after(async () => {
  await prisma.$disconnect();
});
