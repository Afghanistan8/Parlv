/**
 * Case creation wizard. Terms are built by `lib/terms` and validated client-side
 * so a mistake is caught before signing — but the contract's `_terms` is the
 * authority, and every write can still refuse on chain.
 *
 * A defendant is named and the criteria are frozen here. A held sum may be set
 * on either party; it is deposited later, with `fund_case`, after acceptance.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../../../components/Wallet";
import { TermsFields } from "../../../components/TermsFields";
import { write } from "../../../lib/client";
import { DEFAULT_DRAFT, buildTerms, validateDraft, type TermsDraft } from "../../../lib/terms";

export default function NewCasePage() {
  const router = useRouter();
  const { provider, address, wrongNetwork } = useWallet();
  const [draft, setDraft] = useState<TermsDraft>(DEFAULT_DRAFT);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<TermsDraft>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    setError("");
    const problem = validateDraft(draft, { claimant: address ?? undefined });
    if (problem) return setError(problem);
    if (!provider || !address) return setError("Connect a wallet first.");
    if (wrongNetwork) return setError("Switch to Studionet (61999) first.");
    setBusy(true);
    try {
      const { returned } = await write(provider, "open_case", [JSON.stringify(buildTerms(draft))]);
      router.push(`/cases/${returned.case_id as string}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>New case</h1>
      <p className="muted small">
        The claim and criteria freeze here. The respondent accepts this exact version
        by its digest — it cannot change afterwards.
      </p>
      <div className="card">
        <TermsFields draft={draft} set={set} />
        <p className="muted small">
          A held sum is not sent now: the named funder deposits it with{" "}
          <span className="mono">fund_case</span> once the respondent accepts, and the
          case opens when it is deposited in full.
        </p>
        {error && <div className="error">{error}</div>}
        <button disabled={busy} onClick={submit}>
          {busy ? "Signing…" : "Open case (sign with wallet)"}
        </button>
      </div>
    </>
  );
}
