import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for API keys at rest. Payload format: v1:<iv>:<tag>:<ciphertext> (base64).
// `aad` binds a ciphertext to its owner row, so it can't be copied to another user.

const VERSION = "v1";
const IV_BYTES = 12;

export function loadEncryptionKey(secret = process.env.KEY_ENCRYPTION_SECRET): Buffer {
  if (!secret) throw new Error("KEY_ENCRYPTION_SECRET is not set");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) throw new Error("KEY_ENCRYPTION_SECRET must be 32 bytes, base64-encoded");
  return key;
}

export function encryptSecret(plaintext: string, aad: string, key = loadEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string, aad: string, key = loadEncryptionKey()): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Unsupported ciphertext format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
