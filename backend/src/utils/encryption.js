import CryptoJS from 'crypto-js';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto';

const ENC_PREFIX = 'enc:';
const ENC_V2_PREFIX = 'enc:v2:';

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY env var must be at least 32 characters');
  }
  return key;
}

/**
 * Encrypt a plaintext string. Returns `enc:v2:<salt>:<iv>:<tag>:<ciphertext>`.
 * If the value is already encrypted (has the prefix) it is returned as-is,
 * so the function is safe to call multiple times on the same value.
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // already encrypted

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(getKey(), salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_V2_PREFIX}${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 * If the value has no prefix it is returned as-is (handles legacy plaintext rows).
 */
export function decrypt(value) {
  if (!value) return value;
  if (!value.startsWith(ENC_PREFIX)) return value; // legacy plaintext — return as-is

  if (value.startsWith(ENC_V2_PREFIX)) {
    const payload = value.slice(ENC_V2_PREFIX.length);
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload format');
    }

    const [saltB64, ivB64, tagB64, ciphertextB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const key = scryptSync(getKey(), salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  // Legacy CryptoJS format support: `enc:<cryptojs-ciphertext>`
  const ciphertext = value.slice(ENC_PREFIX.length);
  const bytes = CryptoJS.AES.decrypt(ciphertext, getKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}
