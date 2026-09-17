import { auth } from '@/auth';
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { StatusSyncState } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { syncResponseStatus } from '@/lib/operating-status';

export const maxDuration = 30;

const updateSchema = z
  .object({
    categoryCode: z.enum(['UNPAID', 'PAYMENT_CONFIRMED', 'MESSAGE_SENT']).optional(),
    entryStatus: z.enum(['NOT_ENTERED', 'ENTERED']).optional(),
    productStatus: z.enum(['NOT_RECEIVED', 'RECEIVED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update.',
  });

function isRecordNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await params;

  try {
    const input = updateSchema.parse(await request.json());

    const { sourceSettings, ...updated } = await prisma.response.update({
      where: { id },
      data: {
        ...input,
        statusSyncState: StatusSyncState.PENDING,
        lastStatusSyncError: null,
      },
      include: { category: true, sourceSettings: true },
    });

    after(async () => {
      try {
        await syncResponseStatus(userId, updated.id, undefined, {
          ...updated,
          sourceSettings,
        });
      } catch {
        // syncResponseStatus persists FAILED and the error message on the row.
      }
    });

    return NextResponse.json({ response: updated, syncError: null });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: 'Response not found.' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
