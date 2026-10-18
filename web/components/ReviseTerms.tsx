"use client";

/**
 * A revision of the terms. The contract keeps the same respondent, inspector
 * and earlier-case citation, and refuses the change once the respondent has
 * accepted — so this panel only appears while `get_actions` says revise is
 * allowed, and it carries those fields through untouched.
 */

import { useState } from "react";
import type { Terms } from "../lib/types";
import {
  buildTerms,
  draftFromTerms,
  passthroughFromTerms,
  type TermsDraft,
  validateDraft,
} from "../lib/terms";
import { TermsFields } from "./TermsFields";

export function ReviseTerms({
  terms,
  busy,
  onCancel,
  submit,
}: {
  terms: Terms;
  busy: boolean;
  onCancel: () => void;
  submit: (termsJson: string) => void;
}) {
  const [draft, setDraft] = useState<TermsDraft>(() => draftFromTerms(terms));
  const [error, setError] = useState("");

  function send() {
    const problem = validateDraft(draft, { requireRespondent: false, claimant: terms.claimant });
    if (problem) return setError(problem);
    setError("");
    submit(JSON.stringify(buildTerms(draft, passthroughFromTerms(terms))));
  }

  return (
    <div className="card">
      <h3>Revise terms (version {terms.version} → {terms.version + 1})</h3>
      <p className="muted small">
        This writes a new version. The respondent must accept the new digest before the
        case can open, and the inspector has to accept it again too. The respondent,
        the inspector and any required evidence stay as they are.
      </p>
      <TermsFields draft={draft} set={(patch) => setDraft((d) => ({ ...d, ...patch }))} lockParties />
      {error && <div className="error">{error}</div>}
      <button disabled={busy} onClick={send}>
        {busy ? "Signing…" : "Revise terms (sign with wallet)"}
      </button>{" "}
      <button className="ghost" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
