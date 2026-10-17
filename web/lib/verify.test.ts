import { describe, expect, it } from "vitest";
import { canonDeep, withoutMutable } from "./verify";

describe("canonDeep (must match the contract's _canon)", () => {
  it("sorts keys and uses compact separators", () => {
    expect(canonDeep({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe('{"a":[2,{"c":3,"d":4}],"b":1}');
  });
  it("matches Python json.dumps(sort_keys, separators)", () => {
    expect(canonDeep({ z: "x\"y", n: null })).toBe('{"n":null,"z":"x\\"y"}');
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
