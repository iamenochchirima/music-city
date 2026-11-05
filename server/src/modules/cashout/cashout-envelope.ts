import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { HttpError } from "../../utils/http-error.js";

// The key is server configuration, never a wallet key. Bind ciphertext to this exact attempt.
export function createCashOutEnvelopeCipher(key: Buffer) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("Cash-out envelope encryption requires a 32-byte key");
  const secret = Buffer.from(key);
  function aad(orderId: string, attemptId: string, hash: string) {
    return Buffer.from(JSON.stringify(["music-city-cash-out-v1", orderId, attemptId, hash]), "utf8");
  }
  return {
    encrypt(orderId: string, attemptId: string, hash: string, xdr: string): Buffer {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", secret, nonce);
      cipher.setAAD(aad(orderId, attemptId, hash));
      const ciphertext = Buffer.concat([cipher.update(xdr, "utf8"), cipher.final()]);
      return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), ciphertext]);
    },
    decrypt(orderId: string, attemptId: string, hash: string, payload: Buffer): string {
      try {
        if (!Buffer.isBuffer(payload) || payload.length < 30 || payload[0] !== 1) throw new Error("Invalid envelope");
        const decipher = createDecipheriv("aes-256-gcm", secret, payload.subarray(1, 13));
        decipher.setAAD(aad(orderId, attemptId, hash));
        decipher.setAuthTag(payload.subarray(13, 29));
        return Buffer.concat([decipher.update(payload.subarray(29)), decipher.final()]).toString("utf8");
      } catch { throw new HttpError(503, "The saved transfer cannot be recovered"); }
    },
  };
}
