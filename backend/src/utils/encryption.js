import CryptoJS from 'crypto-js';

const ENC_PREFIX = 'enc:';

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY env var must be at least 32 characters');
  }
  return key;
}

/**
 * Encrypt a plaintext string. Returns `enc:<base64ciphertext>`.
 * If the value is already encrypted (has the prefix) it is returned as-is,
 * so the function is safe to call multiple times on the same value.
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // already encrypted
  const ciphertext = CryptoJS.AES.encrypt(plaintext, getKey()).toString();
  return `${ENC_PREFIX}${ciphertext}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 * If the value has no prefix it is returned as-is (handles legacy plaintext rows).
 */
export function decrypt(value) {
  if (!value) return value;
  if (!value.startsWith(ENC_PREFIX)) return value; // legacy plaintext — return as-is
  const ciphertext = value.slice(ENC_PREFIX.length);
  const bytes = CryptoJS.AES.decrypt(ciphertext, getKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}
