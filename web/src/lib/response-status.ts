import { StatusSyncState } from '@/generated/prisma/enums';
import type { CategoryCode, EntryStatus, ProductStatus } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

export type ResponseStatusInput = {
  categoryCode?: CategoryCode;
  entryStatus?: EntryStatus;
  productStatus?: ProductStatus;
};

export class ResponseNotFoundError extends Error {
  constructor(responseId: string) {
    super(`Response not found: ${responseId}`);
    this.name = 'ResponseNotFoundError';
  }
}

function isRecordNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

/**
 * Applies manager edits to operating status fields and marks the row as waiting
 * for the operating status Sheet sync. Source response fields are not touched.
 */
export async function updateResponseStatus(responseId: string, input: ResponseStatusInput) {
  try {
    return await prisma.response.update({
      where: { id: responseId },
      data: {
        ...input,
        statusSyncState: StatusSyncState.PENDING,
        lastStatusSyncError: null,
      },
      include: { category: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new ResponseNotFoundError(responseId);
    }

    throw error;
  }
}
