import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/workspace';
import { resolveSyncAccess, runResponseSync } from '@/lib/response-sync-run';

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const access = resolveSyncAccess(await getWorkspaceContext(userId));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sourceSettings = access.sourceSettings;
  const syncRun = await prisma.syncRun.create({
    data: {
      sourceSettingsId: sourceSettings.id,
      kind: 'responses',
    },
  });

  try {
    const result = await runResponseSync(userId, sourceSettings);

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        success: true,
        finishedAt: new Date(),
        processedCount: result.processedCount,
      },
    });

    return NextResponse.json({
      ok: true,
      processedCount: result.processedCount,
      generatedCount: result.generatedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Response sync failed.';
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
