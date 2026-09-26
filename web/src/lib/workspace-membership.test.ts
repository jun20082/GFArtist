import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detachFromCurrentWorkspace } from './workspace-membership';
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

async function setCurrent(userId: string, workspaceId: string) {
  await prisma.user.update({ where: { id: userId }, data: { currentWorkspaceId: workspaceId } });
}

describe('detachFromCurrentWorkspace', () => {
  test('소유자가 삭제하면 워크스페이스·설정·응답·멤버·초대가 사라진다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });
    const workspaceId = settings.workspaceId as string;
    await addWorkspaceMember(workspaceId, 'user-2', 'OPERATOR');
    await createResponse(settings.id, { name: '삭제 대상', phoneRaw: '010-1111-2222' });
    await setCurrent('user-2', workspaceId);

    const result = await detachFromCurrentWorkspace('user-1');

    assert.deepEqual(result, { action: 'deleted' });
    assert.equal(await prisma.workspace.count(), 0);
    assert.equal(await prisma.workspaceMember.count(), 0);
    assert.equal(await prisma.sourceSettings.count(), 0);
    assert.equal(await prisma.response.count(), 0);

    const operator = await prisma.user.findUniqueOrThrow({ where: { id: 'user-2' } });
    assert.equal(operator.currentWorkspaceId, null);
  });

  test('삭제하면 스프레드시트 점유가 풀린다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });

    await detachFromCurrentWorkspace('user-1');

    const leftover = await prisma.sourceSettings.findUnique({
      where: { spreadsheetId: settings.spreadsheetId },
    });
    assert.equal(leftover, null);
  });

  test('운영자가 나가면 자기 멤버십만 사라지고 응답·워크스페이스는 남는다', async () => {
    await setup();
    const settings = await createSourceSettings({ userId: 'user-1' });
    const workspaceId = settings.workspaceId as string;
    await addWorkspaceMember(workspaceId, 'user-2', 'OPERATOR');
    await createResponse(settings.id, { name: '보존', phoneRaw: '010-3333-4444' });
    await setCurrent('user-2', workspaceId);

    const result = await detachFromCurrentWorkspace('user-2');

    assert.deepEqual(result, { action: 'left' });
    assert.equal(await prisma.workspace.count(), 1);
    assert.equal(await prisma.sourceSettings.count(), 1);
    assert.equal(await prisma.response.count(), 1);

    const operator = await prisma.user.findUniqueOrThrow({ where: { id: 'user-2' } });
    assert.equal(operator.currentWorkspaceId, null);
    assert.equal(
      await prisma.workspaceMember.count({ where: { workspaceId, userId: 'user-2' } }),
      0,
    );
    assert.equal(
      await prisma.workspaceMember.count({ where: { workspaceId, userId: 'user-1' } }),
      1,
    );
  });

  test('다른 워크스페이스를 소유한 운영자가 나가도 그 소유 워크스페이스는 남는다', async () => {
    await setup();
    const owned = await createSourceSettings({ userId: 'user-2' });
    const other = await createSourceSettings({ userId: 'user-1' });
    await addWorkspaceMember(other.workspaceId as string, 'user-2', 'OPERATOR');
    await setCurrent('user-2', other.workspaceId as string);

    const result = await detachFromCurrentWorkspace('user-2');

    assert.deepEqual(result, { action: 'left' });
    assert.ok(await prisma.workspace.findUnique({ where: { id: owned.workspaceId as string } }));
    assert.ok(await prisma.workspace.findUnique({ where: { id: other.workspaceId as string } }));
  });

  test('워크스페이스가 없으면 거부한다', async () => {
    await setup();
    await createUser('user-9');

    await assert.rejects(() => detachFromCurrentWorkspace('user-9'), /워크스페이스가 없습니다/);
  });
});

after(async () => {
  await prisma.$disconnect();
});
