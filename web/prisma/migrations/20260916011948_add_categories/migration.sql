/*
  Warnings:

  - You are about to drop the column `category` on the `Response` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Response" DROP COLUMN "category",
ADD COLUMN     "categoryCode" "CategoryCode" NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "Category" (
    "code" "CategoryCode" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("code")
);

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "Category"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
