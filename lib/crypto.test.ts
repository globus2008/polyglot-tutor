import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, loadEncryptionKey } from "./crypto";

const key = randomBytes(32);

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value", () => {
    const payload = encryptSecret("sk-test-123", "user:a", key);
    expect(payload.startsWith("v1:")).toBe(true);
    expect(payload).not.toContain("sk-test-123");
    expect(decryptSecret(payload, "user:a", key)).toBe("sk-test-123");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", "user:a", key)).not.toBe(encryptSecret("same", "user:a", key));
  });

  it("rejects a ciphertext moved to another owner", () => {
    const payload = encryptSecret("sk-test-123", "user:a", key);
    expect(() => decryptSecret(payload, "user:b", key)).toThrow();
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, ct] = encryptSecret("sk-test-123", "user:a", key).split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"), "user:a", key)).toThrow();
  });

  it("rejects the wrong key", () => {
    const payload = encryptSecret("sk-test-123", "user:a", key);
    expect(() => decryptSecret(payload, "user:a", randomBytes(32))).toThrow();
  });
});

describe("loadEncryptionKey", () => {
  it("requires 32 bytes", () => {
    expect(() => loadEncryptionKey(undefined)).toThrow();
    expect(() => loadEncryptionKey(randomBytes(16).toString("base64"))).toThrow();
    expect(loadEncryptionKey(randomBytes(32).toString("base64"))).toHaveLength(32);
  });
});
