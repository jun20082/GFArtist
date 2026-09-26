-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "AccessInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'OPERATOR',
    "status" "InviteStatus" NOT NULL DEFAULT 'INVITED',
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "AccessInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessInvite_email_idx" ON "AccessInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccessInvite_workspaceId_email_key" ON "AccessInvite"("workspaceId", "email");

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessInvite" ADD CONSTRAINT "AccessInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
