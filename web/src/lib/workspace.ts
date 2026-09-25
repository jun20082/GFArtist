import type { SourceSettings, Workspace } from '@/generated/prisma/client';
import type { WorkspaceRole } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

export type WorkspaceContext = {
  workspace: Workspace;
  role: WorkspaceRole;
  sourceSettings: SourceSettings | null;
};

/**
 * A user currently belongs to a single workspace. If several memberships exist
 * one day, the oldest one stays the default.
 */
export async function getWorkspaceContext(userId: string): Promise<WorkspaceContext | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { workspace: { include: { sourceSettings: true } } },
  });

  if (!membership) {
    return null;
  }

  return {
    workspace: membership.workspace,
    role: membership.role,
    sourceSettings: membership.workspace.sourceSettings,
  };
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

export async function ensureOwnedWorkspace(userId: string, name: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
    include: { workspace: true },
  });

  if (existing) {
    return existing.workspace;
  }

  return prisma.workspace.create({
    data: {
      name,
      ownerUserId: userId,
      members: { create: { userId, role: 'OWNER' } },
    },
  });
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
