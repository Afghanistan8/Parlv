"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STUDIONET_CHAIN_ID, STUDIONET_EXPLORER, STUDIONET_RPC_URL } from "../lib/config";
import type { Eip1193Provider } from "../lib/client";

/** 61999 as a hex chain id, the form wallets expect. */
const STUDIONET_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}`;

interface WalletState {
  address: string | null;
  chainId: number | null;
  provider: Eip1193Provider | null;
  wrongNetwork: boolean;
  connect: () => Promise<void>;
  switchToStudionet: () => Promise<void>;
}

const Ctx = createContext<WalletState>({
  address: null,
  chainId: null,
  provider: null,
  wrongNetwork: false,
  connect: async () => {},
  switchToStudionet: async () => {},
});

export const useWallet = () => useContext(Ctx);

type InjectedProvider = Eip1193Provider & {
  on?: (event: string, listener: () => void) => void;
};

function injected(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: InjectedProvider }).ethereum ?? null;
}

/** 0x1234…abcd for the top bar; the full value stays in the DOM title. */
export function shorten(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** EIP-6963 wallet discovery + Studionet gate. No keys in the app. */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);

  const refresh = useCallback(async (p: Eip1193Provider) => {
    try {
      const [accounts, chainHex] = await Promise.all([
        p.request({ method: "eth_accounts" }) as Promise<string[]>,
        p.request({ method: "eth_chainId" }) as Promise<string>,
      ]);
      setAddress(accounts[0] ?? null);
      setChainId(parseInt(chainHex, 16));
    } catch {
      /* wallet locked or unavailable */
    }
  }, []);

  useEffect(() => {
    let adopted = false;
    const adopt = (p: InjectedProvider) => {
      if (adopted) return;
      adopted = true;
      setProvider(p);
      void refresh(p);
      if (typeof p.on === "function") {
        p.on("accountsChanged", () => void refresh(p));
        p.on("chainChanged", () => void refresh(p));
      }
    };
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent).detail as { provider?: InjectedProvider } | undefined;
      if (d?.provider) adopt(d.provider);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    // Wallets that inject window.ethereum without EIP-6963 fall back here.
    const fallback = injected();
    if (fallback) adopt(fallback);
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [refresh]);

  const connect = useCallback(async () => {
    let p = provider as InjectedProvider | null;
    if (!p) {
      p = injected();
      if (!p) {
        window.dispatchEvent(new Event("eip6963:requestProvider"));
        throw new Error(
          "No browser wallet found. Install an EIP-6963 wallet (for example MetaMask), then reload.",
        );
      }
      setProvider(p);
    }
    const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
    setAddress(accounts[0] ?? null);
    await refresh(p);
  }, [provider, refresh]);

  const switchToStudionet = useCallback(async () => {
    if (!provider) throw new Error("Connect a wallet first.");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: STUDIONET_HEX }],
      });
    } catch (e) {
      // 4902: the wallet does not know Studionet yet — offer to add it.
      if ((e as { code?: number }).code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: STUDIONET_HEX,
              chainName: "GenLayer Studionet",
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
              rpcUrls: [STUDIONET_RPC_URL],
              blockExplorerUrls: [STUDIONET_EXPLORER],
            },
          ],
        });
      } else {
        throw e;
      }
    }
    await refresh(provider);
  }, [provider, refresh]);

  return (
    <Ctx.Provider
      value={{
        address,
        chainId,
        provider,
        wrongNetwork: chainId !== null && chainId !== STUDIONET_CHAIN_ID,
        connect,
        switchToStudionet,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function WalletBar() {
  const { address, chainId, wrongNetwork, connect, switchToStudionet } = useWallet();
  const [err, setErr] = useState("");
  return (
    <div className="walletbar">
      {address ? (
        <>
          <span className="mono" title={address}>{shorten(address)}</span>{" "}
          {wrongNetwork ? (
            <>
              <span className="pill bad">chain {chainId} — wrong network</span>{" "}
              <button
                className="ghost"
                onClick={() => switchToStudionet().catch((e: Error) => setErr(e.message))}
              >
                Switch to Studionet
              </button>
            </>
          ) : (
            <span className="pill final">Studionet</span>
          )}
        </>
      ) : (
        <>
          <button onClick={() => connect().catch((e: Error) => setErr(e.message))}>
            Connect wallet
          </button>{" "}
          <span className="muted">EIP-6963 wallet, Studionet only</span>
        </>
      )}
      {err && <span className="error">{err}</span>}
    </div>
  );
}
