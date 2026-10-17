/**
 * App-contract parity: the frontend renders `get_actions` directly instead of
 * reimplementing the rules, so the gate keys the contract emits and the keys
 * the app reads must be identical.
 *
 * These tests read the contract source, this app's `Acts` type, and the case
 * page, and assert the three agree. A rename on either side fails here before
 * it can silently hide a button — and a hidden "Withdraw case" or "Close
 * challenge" button removes a right the contract grants.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT = resolve(here, "../../contracts/parlv.py");
const TYPES = resolve(here, "./types.ts");
const PAGE = resolve(here, "../app/cases/[id]/page.tsx");

/** Gates that move money or close a case; losing one is a real defect. */
const CRITICAL_GATES = [
  "assess",
  "challenge",
  "readjudicate",
  "close_challenge",
  "finalize",
  "withdraw",
] as const;

function contractGateKeys(): Set<string> {
  const s = readFileSync(CONTRACT, "ascii");
  const m = s.match(/return \{"role": role,[\s\S]*?\}/);
  if (!m) throw new Error("get_actions return dict not found");
  return new Set([...m[0].matchAll(/"(\w+)"\s*:/g)].map((x) => x[1]));
}

function typeGateKeys(): Set<string> {
  const s = readFileSync(TYPES, "utf8");
  const m = s.match(/export interface Acts \{([\s\S]*?)\}/);
  if (!m) throw new Error("Acts interface not found");
  return new Set([...m[1].matchAll(/^\s*([A-Za-z_]\w*):/gm)].map((x) => x[1]));
}

function pageGateKeys(): Set<string> {
  const s = readFileSync(PAGE, "utf8");
  return new Set([...s.matchAll(/acts\.([A-Za-z_]\w*)/g)].map((x) => x[1]));
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

describe("get_actions shape (contract <-> app)", () => {
  it("the contract emits exactly the gates the app's Acts type declares", () => {
    const contract = contractGateKeys();
    const app = typeGateKeys();
    expect(diff(contract, app)).toEqual([]);
    expect(diff(app, contract)).toEqual([]);
  });

  it("the case page reads only gates the contract emits", () => {
    expect(diff(pageGateKeys(), contractGateKeys())).toEqual([]);
  });

  it("the case page renders every money/finality gate", () => {
    const page = pageGateKeys();
    for (const gate of CRITICAL_GATES) expect(page.has(gate)).toBe(true);
  });
});
