/**
 * Parlv network + contract configuration.
 *
 * Studionet ONLY. The app refuses to sign or read on any other chain:
 * every write path checks chainId === 61999 first, and the UI blocks
 * wallets on the wrong network before a transaction can be built.
 */

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER = "https://explorer-studio.genlayer.com";

/** Deployment of record — written by scripts/deploy.mjs --record. */
const PARLV_CONTRACT_FALLBACK = "0x85c9bbdAe943e04e43E0ad3B560fC3Bd9041bf57" as const;
export const PARLV_CONTRACT =
  (process.env.NEXT_PUBLIC_PARLV_CONTRACT as `0x${string}` | undefined) ??
  PARLV_CONTRACT_FALLBACK;

export const PARLV_RULES = "parlv-rules-1";
export const PARLV_RECEIPT_SCHEMA = "parlv.receipt/1";

export const CONTRACT_LIMITS = {
  title: 120,
  claim: 400,
  subjectRef: 80,
  criterion: 300,
  line: 300,
  reason: 1000,
  fileName: 120,
  text: 6000,
  declaredDate: 40,
  redactionNote: 160,
  criteria: 6,
  limitations: 4,
  required: 4,
  imageBytes: 400_000,
  versions: 20,
} as const;

export function assertStudionet(chainId: number): void {
  if (chainId !== STUDIONET_CHAIN_ID) {
    throw new Error(
      `Parlv runs on Studionet (chain ${STUDIONET_CHAIN_ID}) only — wallet is on chain ${chainId}. Switch networks first.`
    );
  }
}
