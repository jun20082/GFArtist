import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.category.createMany({
    data: [
      { code: 'UNPAID', name: '입금 안 함', color: '#94a3b8', sortOrder: 1 },
      { code: 'PAYMENT_CONFIRMED', name: '입금 확인', color: '#facc15', sortOrder: 2 },
      { code: 'MESSAGE_SENT', name: '문자 발송 완료', color: '#4ade80', sortOrder: 3 },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
