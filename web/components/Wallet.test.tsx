/**
 * The wallet layer must let the user choose among every installed wallet.
 * A regression here is the difference between "Connect" working and the app
 * being locked to whichever wallet happened to announce first.
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletBar, WalletProvider } from "./Wallet";

function fakeProvider() {
  // Real wallets only expose the account through eth_accounts once connected.
  let connected = false;
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return connected ? ["0x1111111111111111111111111111111111111111"] : [];
      if (method === "eth_requestAccounts") {
        connected = true;
        return ["0x1111111111111111111111111111111111111111"];
      }
      if (method === "eth_chainId") return "0xf22f";
      return null;
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function announce(uuid: string, name: string) {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: { info: { uuid, name, rdns: `com.test.${uuid}` }, provider: fakeProvider() },
    }),
  );
}

describe("wallet discovery and choice", () => {
  it("lists every announced wallet so the user can choose", async () => {
    render(
      <WalletProvider>
        <WalletBar />
      </WalletProvider>,
    );
    await act(async () => {
      announce("u-okx", "OKX Wallet");
      announce("u-kplr", "KPLR Wallet");
    });
    await act(async () => {
      screen.getByRole("button", { name: /connect wallet/i }).click();
    });
    expect(screen.getByRole("button", { name: /okx wallet/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /kplr wallet/i })).toBeTruthy();
  });

  it("connects to the wallet the user picks", async () => {
    render(
      <WalletProvider>
        <WalletBar />
      </WalletProvider>,
    );
    await act(async () => {
      announce("u-okx", "OKX Wallet");
      announce("u-kplr", "KPLR Wallet");
    });
    await act(async () => {
      screen.getByRole("button", { name: /connect wallet/i }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: /okx wallet/i }).click();
    });
    // Connected state renders the shortened address and the chosen wallet's name.
    expect(screen.getByText("0x1111…1111")).toBeTruthy();
    expect(screen.getByText("OKX Wallet")).toBeTruthy();
  });
});
