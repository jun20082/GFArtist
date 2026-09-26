import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { listWorkspaceMembers, removeWorkspaceMember } from './workspace-members';
import { createWorkspaceInvite } from './invites';
import {
  addWorkspaceMember,
  createSourceSettings,
  createUser,
  prisma,
  resetDatabase,
  seedDefaultCategories,
} from './test-db';

async function setup() {
  await resetDatabase();
  await seedDefaultCategories();
  const settings = await createSourceSettings({ userId: 'user-1' });
  await addWorkspaceMember(settings.workspaceId as string, 'user-2', 'OPERATOR');

  return settings;
}

describe('멤버 목록', () => {
  test('소유자와 운영자를 오래된 순으로 돌려준다', async () => {
    const settings = await setup();

    const members = await listWorkspaceMembers(settings.workspaceId as string);

    assert.deepEqual(
      members.map((member) => [member.userId, member.role]),
      [
        ['user-1', 'OWNER'],
        ['user-2', 'OPERATOR'],
      ],
    );
  });
});

describe('멤버 제거', () => {
  test('운영자를 제거하면 소속과 초대가 함께 취소된다', async () => {
    const settings = await setup();
    const guest = await createUser('user-2');
    await prisma.user.update({
      where: { id: guest.id },
      data: { email: 'guest@example.com', currentWorkspaceId: settings.workspaceId },
    });
    await createWorkspaceInvite('user-1', 'guest@example.com');
    await prisma.accessInvite.updateMany({
      where: { email: 'guest@example.com' },
      data: { status: 'ACTIVE', acceptedAt: new Date() },
    });

    await removeWorkspaceMember('user-1', 'user-2');

    assert.equal(
      await prisma.workspaceMember.count({ where: { userId: 'user-2' } }),
      0,
    );

    const invite = await prisma.accessInvite.findFirstOrThrow({
      where: { email: 'guest@example.com' },
    });
    assert.equal(invite.status, 'REVOKED');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-2' } });
    assert.equal(user.currentWorkspaceId, null);
  });

  test('제거하지 않은 다른 멤버는 그대로 남는다', async () => {
    const settings = await setup();
    await addWorkspaceMember(settings.workspaceId as string, 'user-3', 'OPERATOR');

    await removeWorkspaceMember('user-1', 'user-2');

    assert.equal(await prisma.workspaceMember.count(), 2);
    assert.ok(
      await prisma.workspaceMember.findFirst({ where: { userId: 'user-3' } }),
    );
  });

  test('운영자는 멤버를 제거할 수 없다', async () => {
    await setup();

    await assert.rejects(
      () => removeWorkspaceMember('user-2', 'user-1'),
      /소유자만 멤버를 제거할 수 있습니다/,
    );
  });

  test('소유자는 제거할 수 없다', async () => {
    await setup();

    await assert.rejects(
      () => removeWorkspaceMember('user-1', 'user-1'),
      /자기 자신은 제거할 수 없습니다/,
    );
  });

  test('다른 워크스페이스의 멤버는 제거할 수 없다', async () => {
    await setup();
    const other = await createSourceSettings({ userId: 'user-5', partyName: 'B 파티' });
    await addWorkspaceMember(other.workspaceId as string, 'user-6', 'OPERATOR');

    await assert.rejects(
      () => removeWorkspaceMember('user-1', 'user-6'),
      /멤버를 찾을 수 없습니다/,
    );
  });
});

after(async () => {
  await prisma.$disconnect();
});
