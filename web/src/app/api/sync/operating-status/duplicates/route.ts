import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getActiveSourceSettings } from '@/lib/source-settings';
import {
  cleanupOperatingStatusDuplicates,
  previewOperatingStatusDuplicates,
} from '@/lib/operating-status-duplicates';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sourceSettings = await getActiveSourceSettings();

  if (!sourceSettings) {
    return NextResponse.json({ error: 'Active source settings are missing.' }, { status: 400 });
  }

  try {
    const duplicates = await previewOperatingStatusDuplicates(
      session.user.id,
      sourceSettings,
    );

    return NextResponse.json({ duplicates });
  } catch (error) {
    const message = error instanceof Error ? error.message : '중복 조회에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sourceSettings = await getActiveSourceSettings();

  if (!sourceSettings) {
    return NextResponse.json({ error: 'Active source settings are missing.' }, { status: 400 });
  }

  try {
    const result = await cleanupOperatingStatusDuplicates(
      session.user.id,
      sourceSettings,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '중복 정리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
