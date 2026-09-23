-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'OPERATOR');

-- AlterTable
ALTER TABLE "SourceSettings" ADD COLUMN     "appsScriptSecretEncrypted" TEXT,
ADD COLUMN     "appsScriptUrl" TEXT,
ADD COLUMN     "genderHeader" TEXT NOT NULL DEFAULT '성별',
ADD COLUMN     "internalResponseIdHeader" TEXT NOT NULL DEFAULT '_internal_response_id',
ADD COLUMN     "nameHeader" TEXT NOT NULL DEFAULT '이름',
ADD COLUMN     "orderedProductHeader" TEXT NOT NULL DEFAULT '주문 상품',
ADD COLUMN     "phoneHeader" TEXT NOT NULL DEFAULT '전화번호',
ADD COLUMN     "workspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSettings_workspaceId_key" ON "SourceSettings"("workspaceId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSettings" ADD CONSTRAINT "SourceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: move the single active source settings into one workspace.
-- The oldest user becomes the owner; every existing user joins as a member so
-- the current shared party keeps working after the change.
INSERT INTO "Workspace" ("id", "name", "ownerUserId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    s."partyName",
    (SELECT "id" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "SourceSettings" s
WHERE s."isActive" = true
  AND EXISTS (SELECT 1 FROM "User")
ORDER BY s."createdAt" ASC, s."id" ASC
LIMIT 1;

UPDATE "SourceSettings"
SET "workspaceId" = (SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1)
WHERE "id" = (
    SELECT "id" FROM "SourceSettings"
    WHERE "isActive" = true
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1
)
  AND EXISTS (SELECT 1 FROM "Workspace");

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT
    gen_random_uuid()::text,
    w."id",
    u."id",
    CASE WHEN u."id" = w."ownerUserId" THEN 'OWNER'::"WorkspaceRole" ELSE 'OPERATOR'::"WorkspaceRole" END,
    CURRENT_TIMESTAMP
FROM "Workspace" w
CROSS JOIN "User" u
ON CONFLICT ("workspaceId", "userId") DO NOTHING;
