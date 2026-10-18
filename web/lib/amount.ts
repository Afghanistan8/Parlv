/**
 * GEN <-> atto. Every money field the contract stores is a whole number of
 * atto (`held_sum_wei`, `challenge_bond_wei`, credits), and 1 GEN is 10^18
 * atto. The contract refuses anything but a string of digits, so the app
 * converts through BigInt and never through a float.
 */

export const ATTO_PER_GEN = 10n ** 18n;

const DECIMAL_GEN = /^[0-9]+(\.[0-9]+)?$/;

/**
 * Parse a decimal GEN amount ("0.05", "12", "1000") into atto.
 *
 * Returns null for anything that is not a plain non-negative decimal with at
 * most 18 fractional digits — so a typo becomes a visible validation error
 * rather than a silently truncated deposit.
 */
export function attoFromGen(input: string): bigint | null {
  const s = input.trim();
  if (!DECIMAL_GEN.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 18) return null;
  const fracAtto = BigInt((frac + "0".repeat(18)).slice(0, 18));
  return BigInt(whole) * ATTO_PER_GEN + fracAtto;
}

/** Format atto as a decimal GEN amount, with trailing zeros trimmed. */
export function genFromAtto(atto: string | bigint): string {
  const v = typeof atto === "bigint" ? atto : BigInt(atto.trim() || "0");
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const whole = abs / ATTO_PER_GEN;
  const frac = (abs % ATTO_PER_GEN).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** True when the text is a decimal GEN amount, empty allowed. */
export function isGenInput(input: string): boolean {
  const s = input.trim();
  return s === "" || DECIMAL_GEN.test(s);
}
