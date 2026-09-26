-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "extraFields" JSONB;

-- AlterTable
ALTER TABLE "SourceSettings" ADD COLUMN     "displayColumns" TEXT[] DEFAULT ARRAY[]::TEXT[];
