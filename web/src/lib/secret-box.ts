import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypts secrets at rest with AES-256-GCM. The key is the APP_ENCRYPTION_KEY
 * environment variable, 64 hex characters. The stored value is
 * base64(iv).base64(ciphertext).base64(authTag).
 */
export function encryptSecret(plaintext: string, keyHex: string) {
  const key = parseKey(keyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join('.');
}

export function decryptSecret(encrypted: string, keyHex: string) {
  const key = parseKey(keyHex);
  const parts = encrypted.split('.');

  if (parts.length !== 3) {
    throw new Error('저장된 Secret 형식이 올바르지 않습니다.');
  }

  const [ivPart, ciphertextPart, tagPart] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

function parseKey(keyHex: string) {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'APP_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  return Buffer.from(keyHex, 'hex');
}
