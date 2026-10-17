/**
 * Minimal Studionet client over genlayer-js v1 (pinned: genlayer-js@1.1.8).
 *
 * Reads go through `readContract` (no wallet needed). Writes are signed by
 * the user's browser wallet via EIP-6963 and sent with `writeContract`.
 * No backend, no database, no private keys in the app.
 */

"use client";

// genlayer-js v1.1.8 types don't re-export GenLayerClient; derive it from the factory.
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { PARLV_CONTRACT, STUDIONET_RPC_URL, assertStudionet } from "./config";

type Client = ReturnType<typeof createClient>;

/** The minimal EIP-1193 surface this app needs from a browser wallet. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

let client: Client | null = null;

/** Read client: no account, no signer, safe to share. */
export function getClient(): Client {
  if (!client) {
    client = createClient({ chain: studionet, endpoint: STUDIONET_RPC_URL });
  }
  return client;
}

/**
 * Write client: pinned to the connected wallet.
 *
 * genlayer-js signs a write with `account || client.account`, and resolves a
 * plain address into a JSON-RPC account (viem `parseAccount`), so the client
 * MUST carry both the wallet address and the EIP-1193 provider, or the write
 * throws "No account set". The account is re-read on every write so a wallet
 * that is locked, switches account, or leaves Studionet is refused, never
 * silently signed by a stale client.
 */
export function getWriteClient(provider: Eip1193Provider, address: string): Client {
  return createClient({
    chain: studionet,
    endpoint: STUDIONET_RPC_URL,
    account: address as `0x${string}`,
    provider: provider as never,
  });
}

export function getContract(): `0x${string}` {
  return PARLV_CONTRACT;
}

export { PARLV_CONTRACT, STUDIONET_CHAIN_ID, STUDIONET_RPC_URL, assertStudionet } from "./config";

async function parseCalldata<T>(raw: unknown): Promise<T> {
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}

export async function view<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const raw = await getClient().readContract({
    address: getContract(),
    functionName,
    args: args as never[],
  });
  return parseCalldata<T>(raw);
}

/** Current chain id from the wallet (EIP-1193). */
export async function walletChainId(provider: Eip1193Provider): Promise<number> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return parseInt(hex, 16);
}

/** The wallet's addresses ([] while locked). */
export async function walletAccounts(provider: Eip1193Provider): Promise<string[]> {
  return (await provider.request({ method: "eth_accounts" })) as string[];
}

export interface WriteResult {
  hash: `0x${string}`;
  returned: Record<string, unknown>;
}

function returnedOf(receipt: unknown): Record<string, unknown> {
  // genlayer-js receipts carry the decoded return under several shapes;
  // normalize defensively without ever inventing authority.
  const r = receipt as Record<string, unknown>;
  for (const k of ["returned", "result", "data", "output"]) {
    const v = r[k];
    if (typeof v === "string") {
      try {
        return JSON.parse(v) as Record<string, unknown>;
      } catch {
        continue;
      }
    }
    if (v && typeof v === "object") return v as Record<string, unknown>;
  }
  return {};
}

/**
 * Sign and send one state-changing call with the user's wallet.
 *
 * Refuses before signing unless the wallet is on Studionet and unlocked, so
 * the app can never build a transaction the contract's own chain gate would
 * reject. Nothing is sent without an explicit wallet signature.
 */
export async function write(
  provider: Eip1193Provider,
  functionName: string,
  args: unknown[] = [],
  value = 0n
): Promise<WriteResult> {
  const chainId = await walletChainId(provider);
  assertStudionet(chainId);
  const accounts = await walletAccounts(provider);
  const account = accounts[0];
  if (!account) {
    throw new Error("No account is available from the wallet. Unlock it and connect, then try again.");
  }
  const writeClient = getWriteClient(provider, account);
  const hash = (await writeClient.writeContract({
    address: getContract(),
    functionName,
    args: args as never[],
    value,
  })) as `0x${string}`;
  // genlayer-js brands the hash and types the status as its own enum (not
  // exported from the package root); derive both from the client's signature
  // so the call is checked against the real API instead of guessed.
  type ReceiptArgs = Parameters<typeof writeClient.waitForTransactionReceipt>[0];
  const receipt = await writeClient.waitForTransactionReceipt({
    hash: hash as ReceiptArgs["hash"],
    status: "FINALIZED" as ReceiptArgs["status"],
    interval: 4000,
    retries: 90,
  });
  return { hash, returned: returnedOf(receipt) };
}
