import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from './phone';

test('normalizePhone strips hyphens', () => {
  assert.equal(normalizePhone('010-1234-5678'), '01012345678');
});

test('normalizePhone strips spaces', () => {
  assert.equal(normalizePhone('010 1234 5678'), '01012345678');
});

test('normalizePhone keeps digits unchanged', () => {
  assert.equal(normalizePhone('01012345678'), '01012345678');
});

test('normalizePhone removes letters and symbols', () => {
  assert.equal(normalizePhone('+82 (10) 1234-5678'), '821012345678');
});

test('normalizePhone returns empty string for non-digit input', () => {
  assert.equal(normalizePhone('없음'), '');
});
