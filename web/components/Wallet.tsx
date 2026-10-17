"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STUDIONET_CHAIN_ID } from "../lib/config";
import type { Eip1193Provider } from "../lib/client";

interface WalletState {
  address: string | null;
  chainId: number | null;
  provider: Eip1193Provider | null;
  wrongNetwork: boolean;
  connect: () => Promise<void>;
}

const Ctx = createContext<WalletState>({
  address: null,
  chainId: null,
  provider: null,
  wrongNetwork: false,
  connect: async () => {},
});

export const useWallet = () => useContext(Ctx);

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
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.provider && !provider) {
        setProvider(d.provider);
        void refresh(d.provider);
      }
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [provider, refresh]);

  const connect = useCallback(async () => {
    if (!provider) {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      throw new Error("No EIP-6963 wallet found. Install a browser wallet first.");
    }
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    setAddress(accounts[0] ?? null);
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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function WalletBar() {
  const { address, chainId, wrongNetwork, connect } = useWallet();
  const [err, setErr] = useState("");
  return (
    <div className="card small">
      {address ? (
        <>
          <span className="mono">{address}</span>{" "}
          <span className="muted">chain {chainId}</span>{" "}
          {wrongNetwork ? (
            <span className="pill bad">
              Wrong network — switch to Studionet (61999). Signing is blocked.
            </span>
          ) : (
            <span className="pill final">Studionet</span>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => connect().catch((e: Error) => setErr(e.message))}
          >
            Connect wallet
          </button>{" "}
          <span className="muted">EIP-6963 browser wallet, Studionet only.</span>
          {err && <div className="error">{err}</div>}
        </>
      )}
    </div>
  );
}
