import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { passwordHasher } from "@/lib/auth/password";

const PREFIX = "scrypt$";

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1 });
  return `${PREFIX}${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored.startsWith(PREFIX)) return false; // plain-text values are never accepted on the server
  const [, salt, key] = stored.split("$");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = scryptSync(plain, Buffer.from(salt, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

// Every service on the server hashes and checks passwords this way.
passwordHasher.hash = hashPassword;
passwordHasher.verify = verifyPassword;
