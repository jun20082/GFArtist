import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { retryPendingStatusSync } from '@/lib/operating-status';

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await retryPendingStatusSync(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '재시도에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
