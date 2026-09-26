import { prisma } from '@/lib/prisma';
import { invalidateSourceSettingsCache } from '@/lib/source-settings';
import { getWorkspaceContext, type WorkspaceContext } from '@/lib/workspace';

export type DetachResult = { action: 'deleted' | 'left' };

/**
 * Detaches the caller from their current workspace. An owner deletes the whole
 * workspace (members lose access); an operator only leaves their membership.
 * The source spreadsheet itself is never modified.
 */
export async function detachFromCurrentWorkspace(userId: string): Promise<DetachResult> {
  const context = await getWorkspaceContext(userId);

  if (!context) {
    throw new Error('워크스페이스가 없습니다.');
  }

  if (context.role === 'OWNER') {
    await deleteOwnedWorkspace(context);
    return { action: 'deleted' };
  }

  await leaveWorkspace(context, userId);
  return { action: 'left' };
}

/**
 * Deletes the workspace and everything the app stored for it. Responses are
 * removed before the settings because the relation is Restrict-on-delete, and
 * deleting the workspace cascades members and invites and clears each member's
 * current workspace.
 */
async function deleteOwnedWorkspace(context: WorkspaceContext) {
  const workspaceId = context.workspace.id;
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { userId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.response.deleteMany({ where: { sourceSettings: { workspaceId } } });
    await tx.sourceSettings.deleteMany({ where: { workspaceId } });
    await tx.workspace.delete({ where: { id: workspaceId } });
  });

  for (const member of members) {
    invalidateSourceSettingsCache(member.userId);
  }
}

async function leaveWorkspace(context: WorkspaceContext, userId: string) {
  const workspaceId = context.workspace.id;

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.deleteMany({ where: { workspaceId, userId } });
    await tx.user.updateMany({
      where: { id: userId, currentWorkspaceId: workspaceId },
      data: { currentWorkspaceId: null },
    });
  });

  invalidateSourceSettingsCache(userId);
}
