import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOwnedWorkspace } from '@/lib/workspace';
import { detachFromCurrentWorkspace } from '@/lib/workspace-membership';

const createWorkspaceInput = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const input = createWorkspaceInput.parse(await request.json());
    const workspace = await createOwnedWorkspace(session.user.id, input.name);

    return NextResponse.json(
      { workspace: { id: workspace.id, name: workspace.name } },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await detachFromCurrentWorkspace(session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '워크스페이스 정리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
