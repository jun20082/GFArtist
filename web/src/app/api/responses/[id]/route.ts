import { auth } from '@/auth';
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { syncResponseStatus } from '@/lib/operating-status';
import { ResponseNotFoundError, updateResponseStatus } from '@/lib/response-status';

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
    const response = await updateResponseStatus(id, input);

    after(async () => {
      try {
        await syncResponseStatus(userId, response.id);
      } catch {
        // syncResponseStatus persists FAILED and the error message on the row.
      }
    });

    return NextResponse.json({ response, syncError: null });
  } catch (error) {
    if (error instanceof ResponseNotFoundError) {
      return NextResponse.json({ error: 'Response not found.' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
