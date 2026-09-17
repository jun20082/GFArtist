-- CreateEnum
CREATE TYPE "CategoryCode" AS ENUM ('UNPAID', 'PAYMENT_CONFIRMED', 'MESSAGE_SENT');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('NOT_ENTERED', 'ENTERED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('NOT_RECEIVED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "StatusSyncState" AS ENUM ('SYNCED', 'PENDING', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "SourceSettings" (
    "id" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "responseSheetName" TEXT NOT NULL,
    "operatingStatusSheetName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastResponseSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "sourceSettingsId" TEXT NOT NULL,
    "internalResponseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneRaw" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "orderedProduct" TEXT NOT NULL,
    "category" "CategoryCode" NOT NULL DEFAULT 'UNPAID',
    "entryStatus" "EntryStatus" NOT NULL DEFAULT 'NOT_ENTERED',
    "productStatus" "ProductStatus" NOT NULL DEFAULT 'NOT_RECEIVED',
    "statusSyncState" "StatusSyncState" NOT NULL DEFAULT 'PENDING',
    "lastStatusSyncAt" TIMESTAMP(3),
    "lastStatusSyncError" TEXT,
    "sourceRowNumber" INTEGER,
    "lastResponseSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "sourceSettingsId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSettings_spreadsheetId_key" ON "SourceSettings"("spreadsheetId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_internalResponseId_key" ON "Response"("internalResponseId");

-- CreateIndex
CREATE INDEX "Response_sourceSettingsId_name_idx" ON "Response"("sourceSettingsId", "name");

-- CreateIndex
CREATE INDEX "Response_sourceSettingsId_phoneNormalized_idx" ON "Response"("sourceSettingsId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "Response_sourceSettingsId_entryStatus_productStatus_idx" ON "Response"("sourceSettingsId", "entryStatus", "productStatus");

-- CreateIndex
CREATE INDEX "SyncRun_sourceSettingsId_startedAt_idx" ON "SyncRun"("sourceSettingsId", "startedAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_sourceSettingsId_fkey" FOREIGN KEY ("sourceSettingsId") REFERENCES "SourceSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_sourceSettingsId_fkey" FOREIGN KEY ("sourceSettingsId") REFERENCES "SourceSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
