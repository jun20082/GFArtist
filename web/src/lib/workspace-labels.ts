export type WorkspaceRoleName = 'OWNER' | 'OPERATOR';

/** Client-safe labels: this module must not import the Prisma client. */
export const workspaceRoleLabels: Record<WorkspaceRoleName, string> = {
  OWNER: '소유자',
  OPERATOR: '운영자',
};
