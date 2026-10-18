import { describe, expect, it } from "vitest";
import { ATTO_PER_GEN, attoFromGen, genFromAtto, isGenInput } from "./amount";

describe("attoFromGen", () => {
  it("converts whole GEN", () => {
    expect(attoFromGen("1")).toBe(ATTO_PER_GEN);
    expect(attoFromGen("1000")).toBe(1000n * ATTO_PER_GEN);
    expect(attoFromGen("0")).toBe(0n);
  });
  it("converts decimals exactly, without a float in the path", () => {
    expect(attoFromGen("0.05")).toBe(50_000_000_000_000_000n);
    expect(attoFromGen("0.01")).toBe(ATTO_PER_GEN / 100n);
    expect(attoFromGen("1.5")).toBe(ATTO_PER_GEN + ATTO_PER_GEN / 2n);
    // 0.1 + 0.2 in floats is not 0.3; here it is exact.
    expect(attoFromGen("0.3")).toBe(attoFromGen("0.1")! + attoFromGen("0.2")!);
  });
  it("tolerates surrounding whitespace", () => {
    expect(attoFromGen("  0.05  ")).toBe(50_000_000_000_000_000n);
  });
  it("refuses anything that is not a plain decimal", () => {
    for (const bad of ["", " ", "abc", "1.2.3", "1e18", "-1", "+1", "0x10", "1,5", ".5", "1.", "1 000"]) {
      expect(attoFromGen(bad), bad).toBeNull();
    }
  });
  it("refuses more precision than atto can hold", () => {
    expect(attoFromGen("0.000000000000000001")).toBe(1n); // 18 dp is the limit
    expect(attoFromGen("0.0000000000000000001")).toBeNull(); // 19 dp
  });
});

describe("genFromAtto", () => {
  it("round-trips with attoFromGen", () => {
    for (const gen of ["0", "0.01", "0.05", "1", "12.5", "1000"]) {
      expect(genFromAtto(attoFromGen(gen)!)).toBe(gen);
    }
  });
  it("formats a raw atto string the contract would return", () => {
    expect(genFromAtto("50000000000000000")).toBe("0.05");
    expect(genFromAtto(0n)).toBe("0");
  });
  it("trims trailing zeros and keeps significant ones", () => {
    expect(genFromAtto(1n)).toBe("0.000000000000000001");
    expect(genFromAtto(ATTO_PER_GEN / 2n)).toBe("0.5");
  });
  it("does not lose precision above 2^53 atto", () => {
    expect(genFromAtto(attoFromGen("999.999999999999999999")!)).toBe("999.999999999999999999");
  });
});

describe("isGenInput", () => {
  it("accepts empty and decimals, rejects junk", () => {
    expect(isGenInput("")).toBe(true);
    expect(isGenInput("0.5")).toBe(true);
    expect(isGenInput("x")).toBe(false);
  });
});
