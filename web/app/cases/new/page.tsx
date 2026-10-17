/**
 * Case creation wizard. Mirrors the contract's limits client-side
 * (CONTRACT_LIMITS) so refusals are caught before signing — but the
 * contract is the authority, and every write can still refuse on chain.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_LIMITS } from "../../../lib/config";
import { useWallet } from "../../../components/Wallet";
import { write } from "../../../lib/client";

const KINDS = ["WORK_COMPLETED", "CONDITION_AT_TIME", "DELIVERY_MADE", "PAYMENT_MADE", "AGREEMENT_FOLLOWED", "OTHER"];

export default function NewCasePage() {
  const router = useRouter();
  const { provider, address, wrongNetwork } = useWallet();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("DELIVERY_MADE");
  const [subjectRef, setSubjectRef] = useState("");
  const [claim, setClaim] = useState("");
  const [criteria, setCriteria] = useState("");
  const [respondent, setRespondent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function validate(): string {
    if (title.trim().length < 5) return "Give the case a title of at least 5 characters.";
    if (claim.trim().length < 10) return "State the claim in at least 10 characters.";
    if (subjectRef.trim().length < 2) return "Give the subject a short reference (a nickname, not contact details).";
    if (/@|http|www\./i.test(subjectRef)) return "The subject reference must be a nickname, not contact details or a link.";
    const crits = criteria.split("\n").map((s) => s.trim()).filter(Boolean);
    if (crits.length < 1 || crits.length > CONTRACT_LIMITS.criteria) return `Give 1–${CONTRACT_LIMITS.criteria} criteria, one per line.`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(respondent.trim())) return "The respondent must be a wallet address (0x…).";
    if (respondent.trim().toLowerCase() === address?.toLowerCase()) return "The respondent must be a different wallet from the claimant.";
    return "";
  }

  async function submit() {
    setError("");
    const v = validate();
    if (v) return setError(v);
    if (!provider || !address) return setError("Connect a wallet first.");
    if (wrongNetwork) return setError("Switch to Studionet (61999) first.");
    setBusy(true);
    try {
      const terms = {
        title: title.trim(),
        subject_kind: kind,
        subject_ref: subjectRef.trim(),
        time_zone: "UTC",
        window_start: "",
        deadline: "",
        claim: claim.trim(),
        criteria: criteria.split("\n").map((s) => s.trim()).filter(Boolean).map((text) => ({ text, needs_independent: false })),
        allowed: ["PHOTO", "TEXT_DOCUMENT", "DOCUMENT_PAGE", "VIDEO_FRAME"],
        required: [],
        limitations: [],
        respondent: respondent.trim(),
        inspector: "",
        held_sum_wei: "0",
        funder: "",
        challenge_bond_wei: String(10n ** 16n),
        evidence_period_seconds: 3 * 86400,
        challenge_window_seconds: 86400,
        challenge_evidence_seconds: 86400,
        follows_case: "",
      };
      const { returned } = await write(provider, "open_case", [JSON.stringify(terms)]);
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
        <label>Title (≥5 chars, ≤{CONTRACT_LIMITS.title})</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CONTRACT_LIMITS.title} />
        <label>Subject kind</label>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <label>Subject reference (nickname, ≤{CONTRACT_LIMITS.subjectRef})</label>
        <input type="text" value={subjectRef} onChange={(e) => setSubjectRef(e.target.value)} maxLength={CONTRACT_LIMITS.subjectRef} />
        <label>Claim (≥10 chars, ≤{CONTRACT_LIMITS.claim})</label>
        <textarea rows={3} value={claim} onChange={(e) => setClaim(e.target.value)} maxLength={CONTRACT_LIMITS.claim} />
        <label>Criteria (one per line, ≤{CONTRACT_LIMITS.criteria})</label>
        <textarea rows={4} value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder={"100 widgets were delivered\nDelivery was on time"} />
        <label>Respondent wallet</label>
        <input type="text" value={respondent} onChange={(e) => setRespondent(e.target.value)} placeholder="0x…" />
        {error && <div className="error">{error}</div>}
        <button disabled={busy} onClick={submit}>{busy ? "Signing…" : "Open case (sign with wallet)"}</button>
      </div>
    </>
  );
}
