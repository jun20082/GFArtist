import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { revokeWorkspaceInvite } from '@/lib/invites';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const invite = await revokeWorkspaceInvite(session.user.id, id);

    return NextResponse.json({ invite });
  } catch (error) {
    const message = error instanceof Error ? error.message : '초대 취소에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
