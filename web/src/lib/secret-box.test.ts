import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from './secret-box';

const key = 'a'.repeat(64);
const otherKey = 'b'.repeat(64);

describe('secret-box', () => {
  test('암호문은 평문과 다르고 복호화하면 원문이 돌아온다', () => {
    const encrypted = encryptSecret('my-web-app-secret', key);

    assert.notEqual(encrypted, 'my-web-app-secret');
    assert.equal(decryptSecret(encrypted, key), 'my-web-app-secret');
  });

  test('같은 평문도 매번 다른 암호문이 된다', () => {
    assert.notEqual(encryptSecret('secret', key), encryptSecret('secret', key));
  });

  test('다른 키로 복호화하면 실패한다', () => {
    const encrypted = encryptSecret('my-web-app-secret', key);

    assert.throws(() => decryptSecret(encrypted, otherKey));
  });

  test('암호문을 변조하면 실패한다', () => {
    const encrypted = encryptSecret('my-web-app-secret', key);
    const parts = encrypted.split('.');
    const tampered = [parts[0], parts[1], Buffer.from('x'.repeat(16)).toString('base64')].join('.');

    assert.throws(() => decryptSecret(tampered, key));
  });

  test('키 형식이 아니면 안내 문구를 던진다', () => {
    assert.throws(() => encryptSecret('secret', 'short'), /APP_ENCRYPTION_KEY must be 64 hex/);
    assert.throws(() => decryptSecret('a.b.c', 'not-hex-at-all'), /APP_ENCRYPTION_KEY must be 64 hex/);
  });

  test('형식이 다른 저장값은 거부한다', () => {
    assert.throws(() => decryptSecret('plain-value', key), /저장된 Secret 형식/);
  });
});
