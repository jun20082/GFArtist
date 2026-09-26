import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOwnedWorkspace,
  getResponseForMember,
  getWorkspaceContext,
  getWorkspaceMemberships,
  isWorkspaceMember,
  isWorkspaceOwner,
  setCurrentWorkspace,
} from './workspace';
import { getWorkspaceSourceSettings } from './source-settings';
import { retryPendingStatusSync, type OperatingStatusWriter } from './operating-status';
import {
  addWorkspaceMember,
  createResponse,
  createSourceSettings,
  createUser,
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

  test('재시도는 자기 워크스페이스의 대기 건만 처리한다', async () => {    await setup();
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

describe('워크스페이스 전환', () => {
  test('저장된 현재 워크스페이스가 없으면 가장 오래된 소속을 쓰고 기억한다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    await createSourceSettings({ userId: 'user-1', partyName: 'B 파티' });

    const context = await getWorkspaceContext('user-1');
    assert.equal(context?.workspace.id, first.workspaceId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-1' } });
    assert.equal(user.currentWorkspaceId, first.workspaceId);
  });

  test('전환하면 그 워크스페이스의 설정을 사용한다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    const second = await createSourceSettings({ userId: 'user-1', partyName: 'B 파티' });

    await setCurrentWorkspace('user-1', second.workspaceId as string);

    const context = await getWorkspaceContext('user-1');
    assert.equal(context?.workspace.id, second.workspaceId);
    assert.equal(await getWorkspaceSourceSettings('user-1').then((row) => row?.id), second.id);
    assert.notEqual(first.id, second.id);
  });

  test('현재 워크스페이스 소속이 사라지면 다른 소속으로 자동 보정한다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    const second = await createSourceSettings({ userId: 'user-1', partyName: 'B 파티' });

    await setCurrentWorkspace('user-1', second.workspaceId as string);
    await prisma.workspaceMember.deleteMany({
      where: { userId: 'user-1', workspaceId: second.workspaceId as string },
    });

    const context = await getWorkspaceContext('user-1');
    assert.equal(context?.workspace.id, first.workspaceId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-1' } });
    assert.equal(user.currentWorkspaceId, first.workspaceId);
    assert.notEqual(first.workspaceId, second.workspaceId);
  });

  test('멤버가 아닌 워크스페이스로는 전환할 수 없다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    const other = await createSourceSettings({ userId: 'user-2', partyName: 'B 파티' });

    await assert.rejects(
      () => setCurrentWorkspace('user-1', other.workspaceId as string),
      /멤버가 아닙니다/,
    );
  });

  test('소속 목록에 현재 워크스페이스 표시가 포함된다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1', partyName: 'A 파티' });
    const second = await createSourceSettings({ userId: 'user-1', partyName: 'B 파티' });

    await setCurrentWorkspace('user-1', second.workspaceId as string);

    const memberships = await getWorkspaceMemberships('user-1');
    assert.equal(memberships.length, 2);
    assert.deepEqual(
      memberships.map((membership) => [membership.name, membership.isCurrent]),
      [
        ['A 파티', false],
        ['B 파티', true],
      ],
    );
  });
});

describe('워크스페이스 생성', () => {
  test('소유 워크스페이스를 만들고 현재로 설정한다', async () => {
    await setup();
    await createUser('user-1');

    const workspace = await createOwnedWorkspace('user-1', '내 파티');

    assert.equal(workspace.name, '내 파티');

    const membership = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace.id, userId: 'user-1' },
    });
    assert.equal(membership.role, 'OWNER');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-1' } });
    assert.equal(user.currentWorkspaceId, workspace.id);
  });

  test('다른 워크스페이스의 운영자여도 자기 워크스페이스를 만든다', async () => {
    await setup();
    const other = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(other.workspaceId as string, 'user-2', 'OPERATOR');

    const workspace = await createOwnedWorkspace('user-2', 'user2 파티');

    assert.notEqual(workspace.id, other.workspaceId);

    const context = await getWorkspaceContext('user-2');
    assert.equal(context?.workspace.id, workspace.id);
    assert.equal(context?.role, 'OWNER');
  });

  test('이미 소유 워크스페이스가 있어도 새 워크스페이스를 추가한다', async () => {
    await setup();
    const first = await createSourceSettings({ userId: 'user-1' });

    const second = await createOwnedWorkspace('user-1', '두 번째 파티');

    assert.notEqual(first.workspaceId, second.id);
    assert.equal(await prisma.workspace.count(), 2);

    const context = await getWorkspaceContext('user-1');
    assert.equal(context?.workspace.id, second.id);
  });

  test('빈 이름은 거부한다', async () => {
    await setup();
    await createUser('user-1');

    await assert.rejects(() => createOwnedWorkspace('user-1', '   '), /이름/);
  });
});

after(async () => {
  await prisma.$disconnect();
});
