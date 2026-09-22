import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowed, parseAllowedEmails } from './allowed-emails';

describe('parseAllowedEmails', () => {
  test('쉼표로 구분한 여러 이메일을 모두 담는다', () => {
    const allowed = parseAllowedEmails('first@example.com,second@example.com,third@example.com');

    assert.equal(allowed.size, 3);
    assert.ok(allowed.has('first@example.com'));
    assert.ok(allowed.has('second@example.com'));
    assert.ok(allowed.has('third@example.com'));
  });

  test('공백과 대소문자를 정리한다', () => {
    const allowed = parseAllowedEmails('  First@Example.com , SECOND@example.com  ');

    assert.deepEqual([...allowed].sort(), ['first@example.com', 'second@example.com']);
  });

  test('빈 항목과 후행 쉼표를 무시한다', () => {
    const allowed = parseAllowedEmails('a@example.com,,  ,b@example.com,');

    assert.equal(allowed.size, 2);
  });

  test('값이 없으면 빈 집합을 돌려준다', () => {
    assert.equal(parseAllowedEmails(undefined).size, 0);
    assert.equal(parseAllowedEmails(null).size, 0);
    assert.equal(parseAllowedEmails('').size, 0);
  });

  test('사용자 수 상한이 없다', () => {
    const emails = Array.from({ length: 50 }, (_, index) => `user${index}@example.com`);
    const allowed = parseAllowedEmails(emails.join(','));

    assert.equal(allowed.size, 50);
    assert.ok(allowed.has('user49@example.com'));
  });
});

describe('isEmailAllowed', () => {
  const allowed = parseAllowedEmails('first@example.com, second@example.com');

  test('허용된 이메일을 통과시킨다', () => {
    assert.equal(isEmailAllowed('second@example.com', allowed), true);
  });

  test('대문자와 앞뒤 공백을 정리해 판정한다', () => {
    assert.equal(isEmailAllowed('  FIRST@example.com ', allowed), true);
  });

  test('허용 목록에 없으면 거부한다', () => {
    assert.equal(isEmailAllowed('third@example.com', allowed), false);
  });

  test('이메일이 없으면 거부한다', () => {
    assert.equal(isEmailAllowed(undefined, allowed), false);
    assert.equal(isEmailAllowed(null, allowed), false);
    assert.equal(isEmailAllowed('', allowed), false);
  });
});
