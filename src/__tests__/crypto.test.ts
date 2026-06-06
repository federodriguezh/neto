import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../sync/crypto';

describe('crypto', () => {
  it('encrypts and decrypts a round-trip', async () => {
    const plaintext = 'Hello, neto! Portfolio data: GGAL 100 shares @ $2500';
    const passphrase = 'my-strong-passphrase-123';

    const encrypted = await encrypt(plaintext, passphrase);
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');

    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same input (random salt/iv)', async () => {
    const plaintext = 'same data';
    const passphrase = 'same-pass';

    const enc1 = await encrypt(plaintext, passphrase);
    const enc2 = await encrypt(plaintext, passphrase);
    expect(enc1).not.toBe(enc2);

    expect(await decrypt(enc1, passphrase)).toBe(plaintext);
    expect(await decrypt(enc2, passphrase)).toBe(plaintext);
  });

  it('fails to decrypt with wrong passphrase', async () => {
    const encrypted = await encrypt('secret data', 'correct-pass');
    await expect(decrypt(encrypted, 'wrong-pass')).rejects.toThrow();
  });

  it('fails to decrypt truncated ciphertext', async () => {
    await expect(decrypt('abc', 'pass')).rejects.toThrow();
  });

  it('handles empty string', async () => {
    const encrypted = await encrypt('', 'pass');
    const decrypted = await decrypt(encrypted, 'pass');
    expect(decrypted).toBe('');
  });

  it('handles unicode content', async () => {
    const plaintext = 'Datos: ñoño 🎉 — precio: $1.500,50';
    const encrypted = await encrypt(plaintext, 'pass');
    const decrypted = await decrypt(encrypted, 'pass');
    expect(decrypted).toBe(plaintext);
  });

  it('handles large payloads', async () => {
    const plaintext = JSON.stringify({ data: Array(1000).fill({ symbol: 'GGAL', price: 2500 }) });
    const encrypted = await encrypt(plaintext, 'pass');
    const decrypted = await decrypt(encrypted, 'pass');
    expect(decrypted).toBe(plaintext);
  });
});
