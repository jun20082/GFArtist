import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import {
  getActiveSourceSettings,
  saveSourceSettings,
  sourceSettingsInput,
  validateSourceSettings,
} from '@/lib/source-settings';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ sourceSettings: await getActiveSourceSettings() });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const input = sourceSettingsInput.parse(await request.json());
    const validated = await validateSourceSettings(session.user.id, input);
    const sourceSettings = await saveSourceSettings(validated);

    return NextResponse.json({ sourceSettings }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid source settings.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
