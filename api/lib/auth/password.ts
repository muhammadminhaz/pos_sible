/**
 * How passwords are stored and compared. In the browser demo they are plain text (there is no server to protect them);
 * the server swaps in scrypt hashing at startup (lib/server/passwords.ts), so the same service code is correct in both.
 */
export const passwordHasher: { hash: (plain: string) => string; verify: (plain: string, stored: string) => boolean } = {
  hash: (plain) => plain,
  verify: (plain, stored) => plain === stored,
};
