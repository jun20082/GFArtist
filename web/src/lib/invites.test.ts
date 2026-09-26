import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptInvitesForUser,
  createWorkspaceInvite,
  isEmailInvited,
  listWorkspaceInvites,
  revokeWorkspaceInvite,
} from './invites';
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
}

describe('초대 접근 판정', () => {
  test('초대가 없으면 허용하지 않는다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });

    assert.equal(await isEmailInvited('nobody@example.com'), false);
  });

  test('초대하면 허용하고 취소하면 다시 막는다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });

    const invite = await createWorkspaceInvite('user-1', 'Guest@Example.com');

    assert.equal(invite.email, 'guest@example.com');
    assert.equal(await isEmailInvited('guest@example.com'), true);
    assert.equal(await isEmailInvited('GUEST@example.com'), true);

    await revokeWorkspaceInvite('user-1', invite.id);

    assert.equal(await isEmailInvited('guest@example.com'), false);
  });

  test('운영자는 초대할 수 없다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(settings.workspaceId as string, 'user-2', 'OPERATOR');

    await assert.rejects(
      () => createWorkspaceInvite('user-2', 'guest@example.com'),
      /소유자만 초대할 수 있습니다/,
    );
  });

  test('잘못된 이메일은 거부한다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });

    await assert.rejects(() => createWorkspaceInvite('user-1', 'not-an-email'), /올바른 이메일/);
  });

  test('취소한 초대를 다시 보내면 대기 상태로 되돌린다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });

    const first = await createWorkspaceInvite('user-1', 'guest@example.com');
    await revokeWorkspaceInvite('user-1', first.id);

    const second = await createWorkspaceInvite('user-1', 'guest@example.com');

    assert.equal(second.id, first.id);
    assert.equal(second.status, 'INVITED');
    assert.equal(second.acceptedAt, null);
  });

  test('다른 워크스페이스의 초대는 취소할 수 없다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });
    await createSourceSettings({ userId: 'user-2' });

    const invite = await createWorkspaceInvite('user-2', 'guest@example.com');

    await assert.rejects(
      () => revokeWorkspaceInvite('user-1', invite.id),
      /초대를 찾을 수 없습니다/,
    );
  });
});

describe('초대 수락', () => {
  test('로그인 시 멤버가 되고 초대가 참여 중으로 바뀐다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });
    const guest = await createUser('user-9');
    await prisma.user.update({
      where: { id: guest.id },
      data: { email: 'guest@example.com' },
    });

    await createWorkspaceInvite('user-1', 'guest@example.com');

    const accepted = await acceptInvitesForUser('user-9', 'guest@example.com');

    assert.equal(accepted, 1);
    const membership = await prisma.workspaceMember.findFirstOrThrow({
      where: { userId: 'user-9', workspaceId: settings.workspaceId as string },
    });
    assert.equal(membership.role, 'OPERATOR');

    const invites = await listWorkspaceInvites(settings.workspaceId as string);
    assert.equal(invites[0].status, 'ACTIVE');
    assert.ok(invites[0].acceptedAt);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-9' } });
    assert.equal(user.currentWorkspaceId, settings.workspaceId);
  });

  test('두 번 실행해도 멤버십이 중복되지 않는다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });
    await createUser('user-9');
    await createWorkspaceInvite('user-1', 'guest@example.com');

    assert.equal(await acceptInvitesForUser('user-9', 'guest@example.com'), 1);
    assert.equal(await acceptInvitesForUser('user-9', 'guest@example.com'), 0);
    assert.equal(await prisma.workspaceMember.count({ where: { userId: 'user-9' } }), 1);
  });

  test('취소된 초대는 수락되지 않는다', async () => {
    await setup();
    await createSourceSettings({ userId: 'user-1' });
    await createUser('user-9');

    const invite = await createWorkspaceInvite('user-1', 'guest@example.com');
    await revokeWorkspaceInvite('user-1', invite.id);

    assert.equal(await acceptInvitesForUser('user-9', 'guest@example.com'), 0);
    assert.equal(await prisma.workspaceMember.count({ where: { userId: 'user-9' } }), 0);
  });

  test('이미 다른 워크스페이스를 쓰던 사용자의 현재 워크스페이스는 바꾸지 않는다', async () => {
    await setup();
    const own = await createSourceSettings({ userId: 'user-9' });
    await createSourceSettings({ userId: 'user-1' });
    await prisma.user.update({
      where: { id: 'user-9' },
      data: { email: 'guest@example.com', currentWorkspaceId: own.workspaceId },
    });

    await createWorkspaceInvite('user-1', 'guest@example.com');
    await acceptInvitesForUser('user-9', 'guest@example.com');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-9' } });
    assert.equal(user.currentWorkspaceId, own.workspaceId);
    assert.equal(await prisma.workspaceMember.count({ where: { userId: 'user-9' } }), 2);
  });
});

after(async () => {
  await prisma.$disconnect();
});
