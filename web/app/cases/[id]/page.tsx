/**
 * Case detail: state, terms digest, evidence, decision, finality, and the
 * on-chain action gates (get_actions) rendered directly — the app never
 * invents authority. Every write the contract exposes is reachable from here:
 * acceptance, funding, filing (image and text), readiness, assessment,
 * challenge, readjudication, closure, finality, expiry, lapse and withdrawal.
 */
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "../../../components/Wallet";
import { ReviseTerms } from "../../../components/ReviseTerms";
import { TextEvidence } from "../../../components/TextEvidence";
import { view, write } from "../../../lib/client";
import type { Acts, Case, Decision, Evidence, EvidenceKind, Terms } from "../../../lib/types";
import { IMAGE_KINDS } from "../../../lib/terms";
import { genFromAtto } from "../../../lib/amount";
import { cleanImage, toBytesArg } from "../../../lib/image";
import { isContractRefusal } from "../../../lib/errors";

function Can({ label, can, onClick }: { label: string; can: { ok: boolean; why: string } | undefined; onClick?: () => void }) {
  if (!can) return null;
  return (
    <div className="small">
      <button className={can.ok ? "" : "ghost"} disabled={!can.ok} onClick={onClick}>
        {label}
      </button>{" "}
      {!can.ok && <span className="muted">{can.why}</span>}
    </div>
  );
}

const IMAGE_LABEL: Record<string, string> = {
  PHOTO: "Photo",
  VIDEO_FRAME: "Video frame",
  DOCUMENT_PAGE: "Document page",
};

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { provider, address, wrongNetwork } = useWallet();
  const [c, setC] = useState<Case | null>(null);
  const [t, setT] = useState<Terms | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [acts, setActs] = useState<Acts | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState("");
  const [revising, setRevising] = useState(false);
  const [imgKind, setImgKind] = useState<EvidenceKind>("PHOTO");

  const reload = useCallback(async () => {
    setError("");
    setNotFound(false);
    try {
      const kase = await view<Case>("get_case", [id]);
      setC(kase);
      const terms = await view<Terms>("get_terms", [id, kase.accepted_version || kase.version]);
      setT(terms);
      setEvidence(await view<Evidence[]>("get_case_evidence", [id]));
      if (kase.standing) setDecision(await view<Decision>("get_decision", [kase.standing]));
      else setDecision(null);
      if (address) setActs(await view<Acts>("get_actions", [id, address]));
      else setActs(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // A missing case makes get_case refuse on chain; that is not an error the
      // user should see as transport noise.
      setNotFound(isContractRefusal(msg));
      setError(msg);
    }
  }, [id, address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function act(fn: string, args: unknown[] = [], value = 0n): Promise<boolean> {
    if (!provider) {
      setError("Connect a wallet first.");
      return false;
    }
    if (wrongNetwork) {
      setError("Switch to Studionet first.");
      return false;
    }
    setBusy(fn);
    setError("");
    try {
      await write(provider, fn, args, value);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy("");
    }
  }

  async function upload(kind: EvidenceKind, file: File) {
    if (!provider) return setError("Connect a wallet first.");
    if (wrongNetwork) return setError("Switch to Studionet first.");
    setBusy("upload");
    setError("");
    try {
      const cleaned = await cleanImage(file);
      const meta = {
        kind,
        file_name: file.name,
        description: "",
        criteria: t?.criteria.map((x) => x.id) ?? ["C1"],
      };
      // The contract signature is submit_image(cid, meta_json, data).
      await write(provider, "submit_image", [id, JSON.stringify(meta), toBytesArg(cleaned.bytes)]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  if (notFound) {
    return (
      <div className="card error">
        <strong>
          No case <span className="mono">{id.trim().toUpperCase()}</span> on this contract.
        </strong>
        <div className="small">
          The contract refused the read, which means it holds no such case. Check the id on the{" "}
          <Link href="/cases">cases list</Link>, or <Link href="/cases/new">open a new case</Link>.
        </div>
      </div>
    );
  }
  if (error && !c) return <div className="card error">{error}</div>;
  if (!c || !t) return <p className="muted">Loading…</p>;
  const final = c.state === "FINAL";
  const heldGen = t.held_sum_wei && t.held_sum_wei !== "0" ? genFromAtto(t.held_sum_wei) : "0";
  const imageChoices = acts ? IMAGE_KINDS.filter((k) => acts.file[k].ok) : [];
  const imageKind = imageChoices.includes(imgKind) ? imgKind : imageChoices[0];

  return (
    <>
      <h1><span className="mono">{c.case_id}</span> — {t.title}</h1>
      <p>
        <span className={`pill ${final ? "final" : c.state === "OPEN" ? "open" : ""}`}>{c.state}</span>{" "}
        {c.standing && decision && (
          <span className={`pill ${decision.overall === "SUPPORTED" ? "final" : "warn"}`}>
            {decision.overall}{final ? " · FINAL" : " · STANDING (not final)"}
          </span>
        )}
      </p>
      {!final && c.standing && (
        <div className="banner">
          <strong>ACCEPTED ≠ FINALIZED.</strong> A standing decision is not authority.
          Funds move only after the challenge window closes and anyone runs{" "}
          <span className="mono">finalize</span>.
        </div>
      )}
      {final && (
        <div className="banner final">
          <strong>FINAL.</strong> This decision is the last word. Settlement:{" "}
          {c.settlement ? `${c.settlement.to_role} ← ${c.settlement.held_sum_wei} atto` : "nothing held"}.
        </div>
      )}
      <div className="card small">
        <div>Subject: {t.subject_kind} · <span className="mono">{t.subject_ref}</span></div>
        <div>Claim: {t.claim}</div>
        <div>Criteria: {t.criteria.map((x) => x.text).join(" | ")}</div>
        <div>Terms digest: <span className="mono">{c.accepted_digest || "(not yet accepted)"}</span></div>
        <div>
          Held sum: <span className="mono">{heldGen} GEN</span>
          {t.funder && <> · funded by the {t.funder.toLowerCase()}</>} · deposited:{" "}
          <span className="mono">{genFromAtto(c.funded_wei || "0")} GEN</span>
        </div>
        <div>Evidence deadline: <span className="mono">{c.evidence_deadline || "—"}</span></div>
      </div>
      <div className="card">
        <h3>Evidence ({evidence.length})</h3>
        <table>
          <thead><tr><th>ID</th><th>Kind</th><th>Role</th><th>SHA-256</th><th>Filed</th></tr></thead>
          <tbody>
            {evidence.map((e) => (
              <tr key={e.evidence_id}>
                <td className="mono">{e.evidence_id}</td>
                <td>{e.kind}</td>
                <td>{e.role}</td>
                <td className="mono">{e.sha256.slice(0, 16)}…</td>
                <td className="small muted">{e.filed_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {acts && (
          <div>
            <label>Upload image evidence (cleaned in-browser before sending)</label>
            <select
              value={imageKind ?? ""}
              onChange={(e) => setImgKind(e.target.value as EvidenceKind)}
              disabled={imageChoices.length === 0}
            >
              {imageChoices.length === 0 && <option value="">(none allowed by these terms)</option>}
              {imageChoices.map((k) => (
                <option key={k} value={k}>{IMAGE_LABEL[k] ?? k}</option>
              ))}
            </select>
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy !== "" || !imageKind}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && imageKind) void upload(imageKind, f);
              }}
            />
            {imageChoices.length === 0 && <div className="small muted">{acts.file.PHOTO.why}</div>}
          </div>
        )}
        {acts && (
          <TextEvidence
            criteriaIds={t.criteria.map((x) => x.id)}
            enabled={acts.file.TEXT_DOCUMENT.ok}
            why={acts.file.TEXT_DOCUMENT.why}
            busy={busy === "submit_text"}
            submit={(metaJson, text) => act("submit_text", [id, metaJson, text])}
          />
        )}
      </div>
      {decision && (
        <div className="card">
          <h3>Decision {decision.decision_id} (round {decision.round})</h3>
          <div className="small">Overall: <strong>{decision.overall}</strong> · status {decision.status}</div>
          <table>
            <thead><tr><th>Criterion</th><th>Finding</th><th>Floors</th><th>Basis</th></tr></thead>
            <tbody>
              {decision.criteria.map((x) => (
                <tr key={x.id}>
                  <td>{x.id}: {x.text}</td>
                  <td>{x.finding}{x.model_finding && x.model_finding !== x.finding && <span className="muted"> (model: {x.model_finding})</span>}</td>
                  <td className="mono small">{x.floors.join(", ")}</td>
                  <td className="mono small">{x.basis.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="small muted">Digest: <span className="mono">{decision.decision_digest}</span></div>
        </div>
      )}
      {acts && address && (
        <div className="card">
          <h3>Your actions ({acts.role || "no role on this case"})</h3>
          <Can label="Revise terms" can={acts.revise} onClick={() => setRevising((v) => !v)} />
          <Can label="Accept terms" can={acts.accept} onClick={() => act("accept_case", [id, t.digest])} />
          <Can label="Decline" can={acts.decline} onClick={() => act("decline_case", [id, "declined after review"])} />
          <Can label="Withdraw case" can={acts.withdraw_case} onClick={() => act("withdraw_case", [id])} />
          <Can label="Accept inspector role" can={acts.accept_inspector} onClick={() => act("accept_inspector", [id, t.digest])} />
          <Can label={`Fund the held sum (${heldGen} GEN${t.funder ? `, ${t.funder.toLowerCase()}` : ""})`} can={acts.fund} onClick={() => act("fund_case", [id], BigInt(t.held_sum_wei || "0"))} />
          <Can label="Expire this draft" can={acts.expire} onClick={() => act("expire_case", [id])} />
          <Can label="Mark evidence complete" can={acts.ready} onClick={() => act("mark_ready", [id])} />
          <Can label="Request assessment" can={acts.assess} onClick={() => act("request_assessment", [id])} />
          <Can label="Lapse this case" can={acts.lapse} onClick={() => act("lapse_case", [id])} />
          <Can label="Challenge" can={acts.challenge} onClick={() => act("challenge", [id, "The evidence does not establish the claim."], BigInt(t.challenge_bond_wei))} />
          <Can label="Readjudicate" can={acts.readjudicate} onClick={() => act("readjudicate", [id])} />
          <Can label="Close challenge" can={acts.close_challenge} onClick={() => act("close_challenge", [id])} />
          <Can label="Finalize" can={acts.finalize} onClick={() => act("finalize", [id])} />
          <Can label="Withdraw owed funds" can={acts.withdraw} onClick={() => act("withdraw", [])} />
          {busy && <div className="small muted">Working: {busy}…</div>}
        </div>
      )}
      {revising && acts?.revise.ok && (
        <ReviseTerms
          terms={t}
          busy={busy === "revise_terms"}
          onCancel={() => setRevising(false)}
          submit={async (termsJson) => {
            if (await act("revise_terms", [id, termsJson])) setRevising(false);
          }}
        />
      )}
      {error && <div className="card error">{error}</div>}
    </>
  );
}
