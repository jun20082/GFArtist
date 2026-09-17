import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StatusSyncState } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { syncResponseStatus } from '@/lib/operating-status';

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

  const { id } = await params;

  try {
    const input = updateSchema.parse(await request.json());

    const { sourceSettings: _, ...updated } = await prisma.response.update({
      where: { id },
      data: {
        ...input,
        statusSyncState: StatusSyncState.PENDING,
        lastStatusSyncError: null,
      },
      include: { category: true, sourceSettings: true },
    });

    let syncError: string | null = null;
    let response = updated;

    try {
      await syncResponseStatus(session.user.id, updated.id, undefined, {
        ...updated,
        sourceSettings: _,
      });
      response = {
        ...updated,
        statusSyncState: StatusSyncState.SYNCED,
        lastStatusSyncAt: new Date(),
        lastStatusSyncError: null,
      };
    } catch (syncFailure) {
      syncError =
        syncFailure instanceof Error ? syncFailure.message : '운영 상태 동기화에 실패했습니다.';
      response = {
        ...updated,
        statusSyncState: StatusSyncState.FAILED,
        lastStatusSyncError: syncError,
      };
    }

    return NextResponse.json({ response, syncError });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: 'Response not found.' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
