"use client";

/**
 * The editable half of a case's terms. Shared by "New case" and "Revise terms"
 * so both paths build the same object; the contract's `_terms` still validates
 * every field on chain.
 */

import { CONTRACT_LIMITS } from "../lib/config";
import {
  EVIDENCE_KINDS,
  MAX_CHALLENGE_HOURS,
  MAX_EVIDENCE_DAYS,
  MIN_CHALLENGE_HOURS,
  MIN_EVIDENCE_DAYS,
  SUBJECT_KINDS,
  type TermsDraft,
} from "../lib/terms";
import type { EvidenceKind } from "../lib/types";

const KIND_LABEL: Record<EvidenceKind, string> = {
  PHOTO: "Photo",
  VIDEO_FRAME: "Video frame",
  DOCUMENT_PAGE: "Document page",
  TEXT_DOCUMENT: "Text document",
};

export function TermsFields({
  draft,
  set,
  lockParties = false,
}: {
  draft: TermsDraft;
  set: (patch: Partial<TermsDraft>) => void;
  lockParties?: boolean;
}) {
  function toggleKind(kind: EvidenceKind) {
    const next = draft.allowed.includes(kind)
      ? draft.allowed.filter((x) => x !== kind)
      : EVIDENCE_KINDS.filter((x) => x === kind || draft.allowed.includes(x));
    set({ allowed: next });
  }

  return (
    <>
      <label>Title (≥5 chars, ≤{CONTRACT_LIMITS.title})</label>
      <input
        type="text"
        value={draft.title}
        onChange={(e) => set({ title: e.target.value })}
        maxLength={CONTRACT_LIMITS.title}
      />

      <label>Subject kind</label>
      <select value={draft.subjectKind} onChange={(e) => set({ subjectKind: e.target.value })}>
        {SUBJECT_KINDS.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>

      <label>Subject reference (nickname, ≤{CONTRACT_LIMITS.subjectRef})</label>
      <input
        type="text"
        value={draft.subjectRef}
        onChange={(e) => set({ subjectRef: e.target.value })}
        maxLength={CONTRACT_LIMITS.subjectRef}
      />

      <label>Claim (≥10 chars, ≤{CONTRACT_LIMITS.claim})</label>
      <textarea
        rows={3}
        value={draft.claim}
        onChange={(e) => set({ claim: e.target.value })}
        maxLength={CONTRACT_LIMITS.claim}
      />

      <label>Criteria (one per line, ≤6)</label>
      <textarea
        rows={4}
        value={draft.criteriaText}
        onChange={(e) => set({ criteriaText: e.target.value })}
        placeholder={"100 widgets were delivered\nDelivery was on time"}
      />

      <label>Allowed evidence</label>
      <div className="small">
        {EVIDENCE_KINDS.map((k) => (
          <label key={k} className="inline">
            <input
              type="checkbox"
              checked={draft.allowed.includes(k)}
              onChange={() => toggleKind(k)}
            />{" "}
            {KIND_LABEL[k]}
          </label>
        ))}
      </div>

      <label>Respondent wallet</label>
      <input
        type="text"
        value={draft.respondent}
        onChange={(e) => set({ respondent: e.target.value })}
        placeholder="0x…"
        disabled={lockParties}
      />

      <label>Inspector wallet (optional, independent of both parties)</label>
      <input
        type="text"
        value={draft.inspector}
        onChange={(e) => set({ inspector: e.target.value })}
        placeholder="0x… (leave empty if not needed)"
        disabled={lockParties}
      />

      <label>Held sum in GEN (0 = nothing held; otherwise 0.01–1000)</label>
      <input
        type="text"
        value={draft.heldGen}
        onChange={(e) => set({ heldGen: e.target.value })}
        placeholder="0"
      />

      <label>Who deposits the held sum</label>
      <select
        value={draft.funder}
        onChange={(e) => set({ funder: e.target.value })}
        disabled={!draft.heldGen.trim() || draft.heldGen.trim() === "0"}
      >
        <option value="CLAIMANT">Claimant</option>
        <option value="RESPONDENT">Respondent</option>
      </select>

      <label>Challenge bond in GEN (0.01–100)</label>
      <input
        type="text"
        value={draft.bondGen}
        onChange={(e) => set({ bondGen: e.target.value })}
        placeholder="0.01"
      />

      <label>Evidence period in days ({MIN_EVIDENCE_DAYS}–{MAX_EVIDENCE_DAYS})</label>
      <input
        type="text"
        value={draft.evidenceDays}
        onChange={(e) => set({ evidenceDays: e.target.value })}
      />

      <label>Challenge window in hours ({MIN_CHALLENGE_HOURS}–{MAX_CHALLENGE_HOURS})</label>
      <input
        type="text"
        value={draft.challengeWindowHours}
        onChange={(e) => set({ challengeWindowHours: e.target.value })}
      />

      <label>Challenge evidence period in hours ({MIN_CHALLENGE_HOURS}–{MAX_CHALLENGE_HOURS})</label>
      <input
        type="text"
        value={draft.challengeEvidenceHours}
        onChange={(e) => set({ challengeEvidenceHours: e.target.value })}
      />
    </>
  );
}
