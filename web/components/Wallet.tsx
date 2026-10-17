"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STUDIONET_CHAIN_ID, STUDIONET_EXPLORER, STUDIONET_RPC_URL } from "../lib/config";
import type { Eip1193Provider } from "../lib/client";

/** 61999 as a hex chain id, the form wallets expect. */
const STUDIONET_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}`;
const STORAGE_KEY = "parlv.wallet";

/** One discoverable wallet the user can pick. */
export interface WalletOption {
  key: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: Eip1193Provider;
}

interface WalletState {
  address: string | null;
  chainId: number | null;
  provider: Eip1193Provider | null;
  activeName: string | null;
  options: WalletOption[];
  wrongNetwork: boolean;
  connect: (key?: string) => Promise<void>;
  disconnect: () => void;
  switchToStudionet: () => Promise<void>;
}

const Ctx = createContext<WalletState>({
  address: null,
  chainId: null,
  provider: null,
  activeName: null,
  options: [],
  wrongNetwork: false,
  connect: async () => {},
  disconnect: () => {},
  switchToStudionet: async () => {},
});

export const useWallet = () => useContext(Ctx);

type InjectedProvider = Eip1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

interface Eip6963Detail {
  info?: { uuid?: string; name?: string; icon?: string; rdns?: string };
  provider?: InjectedProvider;
}

function injected(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: InjectedProvider }).ethereum ?? null;
}

/** 0x1234…abcd for the top bar; the full value stays in the title attribute. */
export function shorten(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** EIP-6963 multi-wallet discovery + Studionet gate. No keys in the app. */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [active, setActive] = useState<WalletOption | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const add = useCallback((provider: Eip1193Provider, info?: Eip6963Detail["info"]) => {
    setOptions((prev) => {
      if (prev.some((o) => o.provider === provider)) return prev;
      const key = info?.uuid ?? info?.rdns ?? info?.name ?? "injected";
      if (prev.some((o) => o.key === key)) return prev;
      return [
        ...prev,
        {
          key,
          name: info?.name ?? "Browser wallet",
          icon: info?.icon,
          rdns: info?.rdns,
          provider,
        },
      ];
    });
  }, []);

  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<Eip6963Detail>).detail;
      if (d?.provider) add(d.provider, d.info);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    // Some wallets answer the discovery event on a later tick.
    const late = window.setTimeout(() => window.dispatchEvent(new Event("eip6963:requestProvider")), 400);
    // Wallets that only inject window.ethereum (no EIP-6963) end up here too.
    const fallback = injected();
    if (fallback) add(fallback, { name: "Browser wallet" });
    return () => {
      window.clearTimeout(late);
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, [add]);

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

  // Reconnect the last wallet silently (no prompt) once it is discovered.
  useEffect(() => {
    if (active) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!saved) return;
    const opt = options.find((o) => o.key === saved);
    if (!opt) return;
    setActive(opt);
    void refresh(opt.provider);
  }, [options, active, refresh]);

  // Track the active wallet if the user switches account or network.
  useEffect(() => {
    if (!active) return;
    const p = active.provider as InjectedProvider;
    const handler = () => void refresh(active.provider);
    p.on?.("accountsChanged", handler);
    p.on?.("chainChanged", handler);
    return () => {
      p.removeListener?.("accountsChanged", handler);
      p.removeListener?.("chainChanged", handler);
    };
  }, [active, refresh]);

  const connect = useCallback(
    async (key?: string) => {
      const opt = key
        ? options.find((o) => o.key === key)
        : options.length === 1
          ? options[0]
          : null;
      if (!opt) throw new Error("Choose a wallet to connect.");
      let accounts: string[];
      try {
        accounts = (await opt.provider.request({ method: "eth_requestAccounts" })) as string[];
      } catch (e) {
        if ((e as { code?: number }).code === 4001) {
          throw new Error("You declined the connection request in your wallet.");
        }
        throw e;
      }
      window.localStorage.setItem(STORAGE_KEY, opt.key);
      setActive(opt);
      setAddress(accounts[0] ?? null);
      await refresh(opt.provider);
    },
    [options, refresh],
  );

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setActive(null);
    setAddress(null);
    setChainId(null);
  }, []);

  const switchToStudionet = useCallback(async () => {
    if (!active) throw new Error("Connect a wallet first.");
    const p = active.provider;
    try {
      await p.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: STUDIONET_HEX }],
      });
    } catch (e) {
      // 4902: the wallet does not know Studionet yet — offer to add it.
      if ((e as { code?: number }).code === 4902) {
        await p.request({
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
    await refresh(p);
  }, [active, refresh]);

  return (
    <Ctx.Provider
      value={{
        address,
        chainId,
        provider: active?.provider ?? null,
        activeName: active?.name ?? null,
        options,
        wrongNetwork: chainId !== null && chainId !== STUDIONET_CHAIN_ID,
        connect,
        disconnect,
        switchToStudionet,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function WalletBar() {
  const { address, activeName, chainId, options, wrongNetwork, connect, disconnect, switchToStudionet } =
    useWallet();
  const [picker, setPicker] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!picker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicker(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picker]);

  const run = (p: Promise<void>) => p.catch((e: Error) => setErr(e.message));

  function openPicker() {
    setErr("");
    if (options.length === 1) run(connect(options[0].key));
    else setPicker(true);
  }

  return (
    <div className="walletbar">
      {address ? (
        <>
          <span className="pill final">{activeName ?? "Connected"}</span>
          <span className="mono" title={address}>{shorten(address)}</span>
          {wrongNetwork ? (
            <button className="ghost" onClick={() => run(switchToStudionet())}>
              Switch to Studionet
            </button>
          ) : (
            <span className="pill open">chain {chainId}</span>
          )}
          <button className="icon" title="Disconnect" aria-label="Disconnect" onClick={disconnect}>
            ×
          </button>
        </>
      ) : (
        <button onClick={openPicker}>Connect wallet</button>
      )}
      {err && <span className="error">{err}</span>}

      {picker && (
        <div className="wallet-backdrop" role="presentation" onClick={() => setPicker(false)}>
          <div
            className="wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a wallet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wallet-modal-head">
              <strong>Choose a wallet</strong>
              <button className="icon" aria-label="Close" onClick={() => setPicker(false)}>
                ×
              </button>
            </div>
            {options.length === 0 ? (
              <p className="muted small">
                No wallet detected. Install an EIP-6963 wallet — OKX, MetaMask, Rabby, and others —
                then reload this page.
              </p>
            ) : (
              options.map((o) => (
                <button
                  key={o.key}
                  className="wallet-option"
                  onClick={() => {
                    setPicker(false);
                    run(connect(o.key));
                  }}
                >
                  {o.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- wallet icons are inline data URIs, which next/image cannot optimize
                    <img src={o.icon} alt="" width={28} height={28} />
                  ) : (
                    <span className="wallet-dot" aria-hidden="true" />
                  )}
                  <span>{o.name}</span>
                </button>
              ))
            )}
            <p className="muted small modal-foot">Studionet only · chain {STUDIONET_CHAIN_ID}</p>
          </div>
        </div>
      )}
    </div>
  );
}
