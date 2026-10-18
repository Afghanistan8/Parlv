/**
 * Public verification: recompute every digest the contract covers, byte for
 * byte, from live chain state.
 *
 * Mirrors the contract's `_canon` exactly:
 *
 *   json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
 *
 * Both halves matter. `ensure_ascii=True` escapes every character outside
 * printable ASCII to `\uXXXX`, and Python orders object keys by code point
 * where JavaScript orders them by UTF-16 code unit. The parity fixture at
 * `tests/parity/fixtures/canonical.json` pins this file to the contract.
 */

/**
 * One string, encoded the way `json.dumps(ensure_ascii=True)` encodes it: the
 * seven short escapes and `"`/`\` as themselves, every other character below
 * U+0020 and every character above U+007E as `\uXXXX` with lowercase hex, and
 * an astral character as a surrogate pair.
 *
 * `JSON.stringify` would leave non-ASCII raw — a different byte string — so
 * every digest covering a claim, title or description that is not pure ASCII
 * would recompute to a mismatch on a perfectly valid case.
 */
function pyString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    switch (ch) {
      case '"': out += '\\"'; continue;
      case "\\": out += "\\\\"; continue;
      case "\b": out += "\\b"; continue;
      case "\f": out += "\\f"; continue;
      case "\n": out += "\\n"; continue;
      case "\r": out += "\\r"; continue;
      case "\t": out += "\\t"; continue;
      default: break;
    }
    if (cp < 0x20 || cp > 0x7e) {
      if (cp < 0x10000) {
        out += "\\u" + cp.toString(16).padStart(4, "0");
      } else {
        const n = cp - 0x10000;
        out += "\\u" + (0xd800 | ((n >> 10) & 0x3ff)).toString(16).padStart(4, "0");
        out += "\\u" + (0xdc00 | (n & 0x3ff)).toString(16).padStart(4, "0");
      }
    } else {
      out += ch;
    }
  }
  return out + '"';
}

/** Python compares strings by code point; Array#sort compares UTF-16 units. */
function byCodePoint(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const d = (x[i].codePointAt(0) as number) - (y[i].codePointAt(0) as number);
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

/** Canonical JSON exactly as the contract computes it (sort_keys + separators + ASCII). */
export function canonDeep(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonDeep).join(",") + "]";
  if (typeof value === "string") return pyString(value);
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).sort(byCodePoint);
    return "{" + keys.map((k) => pyString(k) + ":" + canonDeep(rec[k])).join(",") + "}";
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
