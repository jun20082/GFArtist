import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { removeWorkspaceMember } from '@/lib/workspace-members';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await params;
    const result = await removeWorkspaceMember(session.user.id, userId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '멤버 제거에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
