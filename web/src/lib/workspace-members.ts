import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/workspace';
import { invalidateSourceSettingsCache } from '@/lib/source-settings';

export type WorkspaceMemberSummary = {
  userId: string;
  email: string | null;
  name: string | null;
  role: 'OWNER' | 'OPERATOR';
  joinedAt: Date;
};

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return members.map((member) => ({
    userId: member.userId,
    email: member.user.email,
    name: member.user.name,
    role: member.role,
    joinedAt: member.createdAt,
  }));
}

/**
 * Removes an operator from the caller's workspace: deletes the membership,
 * revokes the invite for that address and clears the removed user's current
 * workspace so they land on another workspace (or the empty state).
 */
export async function removeWorkspaceMember(actorUserId: string, targetUserId: string) {
  const context = await getWorkspaceContext(actorUserId);

  if (!context) {
    throw new Error('워크스페이스가 없습니다.');
  }

  if (context.role !== 'OWNER') {
    throw new Error('워크스페이스 소유자만 멤버를 제거할 수 있습니다.');
  }

  if (targetUserId === actorUserId) {
    throw new Error('자기 자신은 제거할 수 없습니다.');
  }

  const target = await prisma.workspaceMember.findFirst({
    where: { workspaceId: context.workspace.id, userId: targetUserId },
    include: { user: { select: { email: true } } },
  });

  if (!target) {
    throw new Error('멤버를 찾을 수 없습니다.');
  }

  if (target.role === 'OWNER') {
    throw new Error('소유자는 제거할 수 없습니다.');
  }

  const email = target.user.email?.toLowerCase() ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.delete({ where: { id: target.id } });

    await tx.user.updateMany({
      where: { id: targetUserId, currentWorkspaceId: context.workspace.id },
      data: { currentWorkspaceId: null },
    });

    if (email) {
      await tx.accessInvite.updateMany({
        where: { workspaceId: context.workspace.id, email },
        data: { status: 'REVOKED' },
      });
    }
  });

  invalidateSourceSettingsCache(targetUserId);

  return { removedUserId: targetUserId };
}
