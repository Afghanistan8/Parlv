/**
 * Public verification: recompute every digest the contract covers, byte for
 * byte, from live chain state. Mirrors the contract's _canon exactly:
 * JSON with sorted keys, compact separators, ASCII.
 */

/** Canonical JSON exactly as the contract computes it (sort_keys + separators). */
export function canonDeep(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonDeep).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonDeep((value as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

export async function sha256Hex(ascii: string): Promise<string> {
  const bytes = new TextEncoder().encode(ascii);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function digestOf(value: unknown): Promise<string> {
  return sha256Hex(canonDeep(value));
}

const DECISION_MUTABLE = new Set([
  "status",
  "supersedes",
  "superseded_by",
  "challenge_window_ends",
  "decision_digest",
]);

export function withoutMutable<T extends Record<string, unknown>>(d: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!DECISION_MUTABLE.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}
