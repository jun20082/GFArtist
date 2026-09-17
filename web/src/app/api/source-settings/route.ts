import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import {
  getActiveSourceSettings,
  sourceSettingsInput,
  validateSourceSettings,
} from '@/lib/source-settings';
import { prisma } from '@/lib/prisma';

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

    const sourceSettings = await prisma.$transaction(async (tx) => {
      await tx.sourceSettings.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      return tx.sourceSettings.create({
        data: {
          partyName: validated.partyName,
          spreadsheetId: validated.spreadsheetId,
          responseSheetName: validated.responseSheetName,
          operatingStatusSheetName: validated.operatingStatusSheetName,
          isActive: true,
        },
      });
    });

    return NextResponse.json({ sourceSettings }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid source settings.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
