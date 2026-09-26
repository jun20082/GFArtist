import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { invalidateSourceSettingsCache } from '@/lib/source-settings';
import { setCurrentWorkspace } from '@/lib/workspace';

const inputSchema = z.object({
  workspaceId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { workspaceId } = inputSchema.parse(await request.json());

    await setCurrentWorkspace(session.user.id, workspaceId);
    invalidateSourceSettingsCache(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '워크스페이스 전환에 실패했습니다.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
