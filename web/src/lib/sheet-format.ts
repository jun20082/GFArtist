import type { EntryStatus, ProductStatus } from '../generated/prisma/enums';

export const operatingStatusHeaders = [
  '_internal_response_id',
  '이름',
  '전화번호',
  '입장 여부',
  '상품 수령 여부',
] as const;

export function parseSpreadsheetId(value: string) {
  const input = value.trim();
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = match?.[1] ?? input;

  if (!/^[a-zA-Z0-9-_]+$/.test(spreadsheetId)) {
    throw new Error('Invalid Google Sheets URL or ID.');
  }

  return spreadsheetId;
}

export function quoteSheetName(sheetName: string) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

export function columnLetter(index: number) {
  let value = index + 1;
  let letters = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}

export function formatEntryStatus(status: EntryStatus) {
  return status === 'ENTERED' ? '입장 완료' : '미입장';
}

export function formatProductStatus(status: ProductStatus) {
  return status === 'RECEIVED' ? '수령 완료' : '미수령';
}
