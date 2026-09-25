import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getWorkspaceSourceSettings } from '@/lib/source-settings';
import { searchResponses } from '@/lib/responses';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') ?? '';
  const entryStatus = searchParams.get('entry') as 'NOT_ENTERED' | 'ENTERED' | null;
  const productStatus = searchParams.get('product') as 'NOT_RECEIVED' | 'RECEIVED' | null;

  const sourceSettings = await getWorkspaceSourceSettings(session.user.id);

  if (!sourceSettings) {
    return NextResponse.json({ error: 'Active source settings are missing.' }, { status: 400 });
  }

  const responses = await searchResponses(sourceSettings.id, {
    query,
    entryStatus: entryStatus ?? undefined,
    productStatus: productStatus ?? undefined,
  });

  return NextResponse.json({ responses });
}
