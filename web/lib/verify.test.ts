import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { canonDeep, digestOf, withoutMutable } from "./verify";

const here = dirname(fileURLToPath(import.meta.url));
// The same fixture the contract-side parity test regenerates.
const FIXTURE = resolve(here, "../../tests/parity/fixtures/canonical.json");

interface Case {
  name: string;
  value: unknown;
  canonical: string;
  sha256: string;
}
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
  canon_expr: string;
  cases: Case[];
};

describe("canonDeep (must match the contract's _canon)", () => {
  it("sorts keys and uses compact separators", () => {
    expect(canonDeep({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe('{"a":[2,{"c":3,"d":4}],"b":1}');
  });
  it("matches Python json.dumps(sort_keys, separators)", () => {
    expect(canonDeep({ z: "x\"y", n: null })).toBe('{"n":null,"z":"x\\"y"}');
  });

  it("escapes non-ASCII exactly as json.dumps(ensure_ascii=True)", () => {
    // JSON.stringify would emit the raw character here, a different byte string.
    expect(canonDeep({ claim: "café" })).toBe('{"claim":"caf\\u00e9"}');
    expect(canonDeep({ note: "配送完了" })).toBe('{"note":"\\u914d\\u9001\\u5b8c\\u4e86"}');
    // Astral characters become a surrogate pair, like Python's.
    expect(canonDeep({ face: "😀" })).toBe('{"face":"\\ud83d\\ude00"}');
    // Python orders keys by code point; UTF-16 ordering would put the emoji first.
    expect(canonDeep({ "\ue000": "bmp", "😀": "astral" })).toBe(
      '{"\\ue000":"bmp","\\ud83d\\ude00":"astral"}',
    );
  });

  it("reproduces every case in the shared app<->contract parity fixture", async () => {
    expect(fixture.cases.length).toBeGreaterThan(15);
    for (const c of fixture.cases) {
      expect(canonDeep(c.value), `${c.name} canonical`).toBe(c.canonical);
      expect(await digestOf(c.value), `${c.name} digest`).toBe(c.sha256);
    }
  });
});

describe("withoutMutable", () => {
  it("drops lifecycle fields from the decision digest", () => {
    const d = {
      status: "FINAL",
      supersedes: "",
      superseded_by: "",
      challenge_window_ends: "x",
      decision_digest: "y",
      overall: "SUPPORTED",
    };
    expect(withoutMutable(d)).toEqual({ overall: "SUPPORTED" });
  });
});
