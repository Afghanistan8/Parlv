import { describe, expect, it } from "vitest";
import { isContractRefusal } from "./errors";

describe("isContractRefusal", () => {
  it("recognises the RPC shape for a contract refusal", () => {
    expect(
      isContractRefusal(
        "Missing or invalid parameters. Double check you have provided the correct parameters. " +
          "Details: execution failed Version: viem@2.37.2",
      ),
    ).toBe(true);
  });

  it("leaves a transport failure alone", () => {
    expect(isContractRefusal("TypeError: Failed to fetch")).toBe(false);
    expect(isContractRefusal("Request timed out after 20000ms")).toBe(false);
  });
});
