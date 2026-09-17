import test from 'node:test';
import assert from 'node:assert/strict';
import {
  columnLetter,
  formatEntryStatus,
  formatProductStatus,
  operatingStatusHeaders,
  parseSpreadsheetId,
  quoteSheetName,
} from './sheet-format';

const spreadsheetId = '1V4fJdiyx4uUkAaAFoZqHF1gYHYGaY62E6nb2jTXrpkg';

test('parseSpreadsheetId extracts id from a full URL', () => {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
  assert.equal(parseSpreadsheetId(url), spreadsheetId);
});

test('parseSpreadsheetId accepts a raw id', () => {
  assert.equal(parseSpreadsheetId(spreadsheetId), spreadsheetId);
});

test('parseSpreadsheetId trims surrounding whitespace', () => {
  assert.equal(parseSpreadsheetId(`  ${spreadsheetId}  `), spreadsheetId);
});

test('parseSpreadsheetId rejects malformed input', () => {
  assert.throws(() => parseSpreadsheetId('not a/valid id'));
});

test('quoteSheetName wraps a tab name in quotes', () => {
  assert.equal(quoteSheetName('설문지 응답'), "'설문지 응답'");
});

test('quoteSheetName doubles internal apostrophes', () => {
  assert.equal(quoteSheetName("운영'상태"), "'운영''상태'");
});

test('columnLetter maps indexes to spreadsheet letters', () => {
  assert.equal(columnLetter(0), 'A');
  assert.equal(columnLetter(25), 'Z');
  assert.equal(columnLetter(26), 'AA');
  assert.equal(columnLetter(51), 'AZ');
  assert.equal(columnLetter(52), 'BA');
});

test('formatEntryStatus maps entry values to Korean labels', () => {
  assert.equal(formatEntryStatus('ENTERED'), '입장 완료');
  assert.equal(formatEntryStatus('NOT_ENTERED'), '미입장');
});

test('formatProductStatus maps product values to Korean labels', () => {
  assert.equal(formatProductStatus('RECEIVED'), '수령 완료');
  assert.equal(formatProductStatus('NOT_RECEIVED'), '미수령');
});

test('operatingStatusHeaders keeps the fixed column order', () => {
  assert.deepEqual([...operatingStatusHeaders], [
    '_internal_response_id',
    '이름',
    '전화번호',
    '입장 여부',
    '상품 수령 여부',
  ]);
});
