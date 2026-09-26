import type { SourceSettings, Workspace } from '@/generated/prisma/client';
import type { WorkspaceRole } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

export type WorkspaceContext = {
  workspace: Workspace;
  role: WorkspaceRole;
  sourceSettings: SourceSettings | null;
};

export { workspaceRoleLabels } from '@/lib/workspace-labels';

/**
 * Resolves the workspace the user is currently working in. The stored
 * currentWorkspaceId wins when the user is still a member; otherwise the oldest
 * membership is used and remembered so the choice stays stable.
 */
export async function getWorkspaceContext(userId: string): Promise<WorkspaceContext | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { currentWorkspaceId: true } },
      workspace: { include: { sourceSettings: true } },
    },
  });

  if (memberships.length === 0) {
    return null;
  }

  const currentWorkspaceId = memberships[0].user.currentWorkspaceId;
  const membership =
    memberships.find((row) => row.workspaceId === currentWorkspaceId) ?? memberships[0];

  if (membership.workspaceId !== currentWorkspaceId) {
    await prisma.user
      .update({ where: { id: userId }, data: { currentWorkspaceId: membership.workspaceId } })
      .catch(() => undefined);
  }

  return {
    workspace: membership.workspace,
    role: membership.role,
    sourceSettings: membership.workspace.sourceSettings,
  };
}

export type WorkspaceMembership = {
  workspaceId: string;
  name: string;
  role: WorkspaceRole;
  isCurrent: boolean;
};

/** Memberships for the workspace switcher, oldest first. */
export async function getWorkspaceMemberships(userId: string): Promise<WorkspaceMembership[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { currentWorkspaceId: true } },
      workspace: { select: { id: true, name: true } },
    },
  });
  const currentWorkspaceId = memberships[0]?.user.currentWorkspaceId ?? null;

  return memberships.map((membership, index) => ({
    workspaceId: membership.workspaceId,
    name: membership.workspace.name,
    role: membership.role,
    isCurrent:
      membership.workspaceId === currentWorkspaceId ||
      (index === 0 && !memberships.some((row) => row.workspaceId === currentWorkspaceId)),
  }));
}

export async function setCurrentWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId },
    select: { id: true },
  });

  if (!membership) {
    throw new Error('이 워크스페이스의 멤버가 아닙니다.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { currentWorkspaceId: workspaceId },
  });
}

export async function isWorkspaceMember(userId: string, workspaceId: string | null) {
  if (!workspaceId) {
    return false;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function isWorkspaceOwner(userId: string, workspaceId: string | null) {
  if (!workspaceId) {
    return false;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId, role: 'OWNER' },
    select: { id: true },
  });

  return Boolean(membership);
}

/**
 * Creates a new workspace owned by the user and makes it current. A user may
 * own several workspaces, so this always creates a new one instead of reusing
 * an existing owned workspace.
 */
export async function createOwnedWorkspace(userId: string, name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error('워크스페이스 이름을 입력하세요.');
  }

  const created = await prisma.workspace.create({
    data: {
      name: trimmed,
      ownerUserId: userId,
      members: { create: { userId, role: 'OWNER' } },
    },
  });

  await prisma.user
    .update({ where: { id: userId }, data: { currentWorkspaceId: created.id } })
    .catch(() => undefined);

  return created;
}

/**
 * Loads a response only when the caller is a member of the workspace that owns
 * it. Callers cannot tell "missing" from "not yours".
 */
export async function getResponseForMember(userId: string, responseId: string) {
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    include: { category: true, sourceSettings: true },
  });

  if (!response) {
    return null;
  }

  const allowed = await isWorkspaceMember(userId, response.sourceSettings.workspaceId);

  return allowed ? response : null;
}
