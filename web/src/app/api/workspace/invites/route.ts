import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createWorkspaceInvite } from '@/lib/invites';

const inputSchema = z.object({
  email: z.string().trim().min(3).max(200),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email } = inputSchema.parse(await request.json());
    const invite = await createWorkspaceInvite(session.user.id, email);

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '초대에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
