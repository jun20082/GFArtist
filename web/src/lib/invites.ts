import { getWorkspaceContext } from '@/lib/workspace';
import { prisma } from '@/lib/prisma';

export function normalizeInviteEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase();
}

function assertInviteEmail(email: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('올바른 이메일 주소를 입력하세요.');
  }
}

/**
 * A login is allowed when the address is on the environment allowlist or has an
 * invite that was not revoked.
 */
export async function isEmailInvited(email: string | null | undefined) {
  const normalized = normalizeInviteEmail(email);

  if (!normalized) {
    return false;
  }

  const invite = await prisma.accessInvite.findFirst({
    where: { email: normalized, status: { not: 'REVOKED' } },
    select: { id: true },
  });

  return Boolean(invite);
}

export async function listWorkspaceInvites(workspaceId: string) {
  return prisma.accessInvite.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createWorkspaceInvite(userId: string, email: string) {
  const context = await getWorkspaceContext(userId);

  if (!context) {
    throw new Error('워크스페이스가 없습니다.');
  }

  if (context.role !== 'OWNER') {
    throw new Error('워크스페이스 소유자만 초대할 수 있습니다.');
  }

  const normalized = normalizeInviteEmail(email);
  assertInviteEmail(normalized);

  return prisma.accessInvite.upsert({
    where: {
      workspaceId_email: { workspaceId: context.workspace.id, email: normalized },
    },
    create: {
      workspaceId: context.workspace.id,
      email: normalized,
      invitedByUserId: userId,
      role: 'OPERATOR',
      status: 'INVITED',
    },
    update: {
      invitedByUserId: userId,
      role: 'OPERATOR',
      status: 'INVITED',
      acceptedAt: null,
    },
  });
}

export async function revokeWorkspaceInvite(userId: string, inviteId: string) {
  const context = await getWorkspaceContext(userId);

  if (!context) {
    throw new Error('워크스페이스가 없습니다.');
  }

  if (context.role !== 'OWNER') {
    throw new Error('워크스페이스 소유자만 초대를 취소할 수 있습니다.');
  }

  const invite = await prisma.accessInvite.findFirst({
    where: { id: inviteId, workspaceId: context.workspace.id },
  });

  if (!invite) {
    throw new Error('초대를 찾을 수 없습니다.');
  }

  return prisma.accessInvite.update({
    where: { id: invite.id },
    data: { status: 'REVOKED' },
  });
}

/**
 * Turns pending invites for this address into workspace memberships. Runs on
 * every login, so it must stay idempotent.
 */
export async function acceptInvitesForUser(
  userId: string,
  email: string | null | undefined,
) {
  const normalized = normalizeInviteEmail(email);

  if (!normalized) {
    return 0;
  }

  const invites = await prisma.accessInvite.findMany({
    where: { email: normalized, status: 'INVITED' },
    orderBy: { createdAt: 'asc' },
  });

  if (invites.length === 0) {
    return 0;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentWorkspaceId: true },
  });

  for (const invite of invites) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      create: { workspaceId: invite.workspaceId, userId, role: invite.role },
      update: {},
    });

    await prisma.accessInvite.update({
      where: { id: invite.id },
      data: { status: 'ACTIVE', acceptedAt: new Date() },
    });
  }

  if (!user?.currentWorkspaceId) {
    await prisma.user
      .update({ where: { id: userId }, data: { currentWorkspaceId: invites[0].workspaceId } })
      .catch(() => undefined);
  }

  return invites.length;
}
