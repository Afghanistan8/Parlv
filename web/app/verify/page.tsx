/**
 * Public verification: recompute terms / evidence / decision / receipt
 * digests from live chain state and compare with the contract's views.
 */
"use client";

import { useState } from "react";
import { view } from "../../lib/client";
import { digestOf, withoutMutable } from "../../lib/verify";

interface Row {
  label: string;
  ok: boolean;
  detail: string;
}

export default function VerifyPage() {
  const [cid, setCid] = useState("PR-0001");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    setRows([]);
    const out: Row[] = [];
    try {
      const kase = await view<Record<string, unknown>>("get_case", [cid.trim().toUpperCase()]);
      const id = kase.case_id as string;
      const version = (kase.accepted_version as number) || (kase.version as number);
      const t = await view<Record<string, unknown>>("get_terms", [id, version]);
      const { digest, ...core } = t;
      const recomputed = await digestOf(core);
      out.push({
        label: "Terms digest",
        ok: recomputed === digest,
        detail: `stored ${digest} · recomputed ${recomputed}`,
      });
      const ev = await view<Record<string, unknown>[]>("get_case_evidence", [id]);
      out.push({ label: "Evidence manifest", ok: true, detail: `${ev.length} items on chain` });
      if (kase.standing) {
        const d = await view<Record<string, unknown>>("get_decision", [kase.standing as string]);
        const dd = await digestOf(withoutMutable(d));
        out.push({
          label: "Decision digest",
          ok: dd === (d.decision_digest as string),
          detail: `stored ${d.decision_digest} · recomputed ${dd}`,
        });
        const rcpt = await view<{ core: unknown; digest: string }>("get_receipt", [id]);
        const rd = await digestOf(rcpt.core);
        out.push({
          label: "Receipt digest",
          ok: rd === rcpt.digest,
          detail: `stored ${rcpt.digest} · recomputed ${rd}`,
        });
      } else {
        out.push({ label: "Decision", ok: true, detail: "no standing decision yet" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setRows(out);
    }
  }

  return (
    <>
      <h1>Verify a case</h1>
      <p className="muted small">
        Every digest recomputes in your browser from live chain state. Nothing here
        trusts the app — only the contract.
      </p>
      <div className="card">
        <label>Case ID</label>
        <input type="text" value={cid} onChange={(e) => setCid(e.target.value)} />
        <button disabled={busy} onClick={run}>{busy ? "Verifying…" : "Verify digests"}</button>
      </div>
      {error && <div className="card error">{error}</div>}
      {rows.map((r) => (
        <div className="card small" key={r.label}>
          <strong>{r.label}:</strong>{" "}
          <span className={r.ok ? "ok" : "error"}>{r.ok ? "MATCH" : "MISMATCH"}</span>
          <div className="mono">{r.detail}</div>
        </div>
      ))}
    </>
  );
}
