/**
 * @module lib/invite-codes
 * @description Invite code generation and normalization utilities.
 *
 * Generates short, human-friendly codes that avoid visually ambiguous
 * characters (0/O, 1/I/L) to reduce entry errors.
 */

/**
 * Character set for invite codes.
 * Excludes 0, O, 1, I, L to avoid visual ambiguity.
 */
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Length of generated invite codes */
const CODE_LENGTH = 6;

/**
 * Generate a random 6-character invite code.
 *
 * Uses `crypto.getRandomValues` when available (browser & Node 19+)
 * for better randomness, falling back to `Math.random`.
 *
 * @returns A 6-character uppercase alphanumeric invite code.
 *
 * @example
 * ```ts
 * generateInviteCode(); // e.g. "X4K9TN"
 * ```
 */
export function generateInviteCode(): string {
  const result: string[] = [];

  // Prefer crypto.getRandomValues for stronger randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < CODE_LENGTH; i++) {
      result.push(CHARS[randomBytes[i] % CHARS.length]);
    }
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) {
      result.push(CHARS[Math.floor(Math.random() * CHARS.length)]);
    }
  }

  return result.join('');
}

/**
 * Normalize a user-entered invite code for comparison.
 *
 * Trims whitespace and converts to uppercase to match
 * the canonical format produced by {@link generateInviteCode}.
 *
 * @param code - The raw user input.
 * @returns The normalized code string.
 *
 * @example
 * ```ts
 * normalizeInviteCode('  x4k9tn  '); // "X4K9TN"
 * ```
 */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}
