/**
 * Guards the read path itself. The whole app reads state through `view`, so the
 * two things that silently broke it once — the transaction-hash variant and the
 * JSON-string return shape — are pinned here, independently of the network.
 */
import { describe, expect, it, vi } from "vitest";

const { readContract } = vi.hoisted(() => ({ readContract: vi.fn(async () => '{"ok":true}') }));

vi.mock("genlayer-js", () => ({ createClient: () => ({ readContract }) }));
vi.mock("genlayer-js/chains", () => ({ studionet: { id: 61999 } }));

import { view } from "./client";

describe("view", () => {
  it("asks the RPC for the transaction hash variant Studionet serves", async () => {
    await expect(view("get_config", [])).resolves.toEqual({ ok: true });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "get_config",
        args: [],
        transactionHashVariant: "latest-final",
      }),
    );
  });

  it("parses a JSON-string return into an object", async () => {
    readContract.mockResolvedValueOnce('{"total":0,"cases":[]}');
    await expect(view("list_cases", [0, 50])).resolves.toEqual({ total: 0, cases: [] });
  });
});
