import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-sheets';
import { parseSpreadsheetId, quoteSheetName } from '@/lib/sheet-format';

export const maxDuration = 30;

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const spreadsheetUrlOrId = url.searchParams.get('spreadsheetUrlOrId')?.trim();
  const tab = url.searchParams.get('tab')?.trim();

  if (!spreadsheetUrlOrId) {
    return NextResponse.json(
      { error: '스프레드시트 URL 또는 ID가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    const spreadsheetId = parseSpreadsheetId(spreadsheetUrlOrId);
    const sheets = await getSheetsClient(session.user.id);

    if (tab) {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quoteSheetName(tab)}!1:1`,
      });
      const headers = (headerResponse.data.values?.[0] ?? [])
        .map((value) => String(value).trim())
        .filter(Boolean);

      return NextResponse.json({ headers });
    }

    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId,sheets.properties',
    });
    const tabs = (metadata.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title));

    return NextResponse.json({ tabs });
  } catch (error) {
    const message = error instanceof Error ? error.message : '시트를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
