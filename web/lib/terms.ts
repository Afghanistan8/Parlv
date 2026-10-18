/**
 * The terms a case is opened — and revised — with.
 *
 * `_terms` in the contract is the authority: it bounds and normalises every
 * field and refuses in words. This module mirrors those limits so a mistake is
 * caught before a signature is asked for, never instead of the contract's own
 * check. A revision keeps the respondent, the inspector, the required
 * evidence and the limitations it already had, so those ride along unchanged.
 */

import { ATTO_PER_GEN, attoFromGen, genFromAtto } from "./amount";
import { CONTRACT_LIMITS } from "./config";
import type { EvidenceKind, Terms } from "./types";

export const SUBJECT_KINDS = [
  "WORK_COMPLETED",
  "CONDITION_AT_TIME",
  "DELIVERY_MADE",
  "PAYMENT_MADE",
  "AGREEMENT_FOLLOWED",
  "OTHER",
] as const;

export const EVIDENCE_KINDS: EvidenceKind[] = [
  "PHOTO",
  "VIDEO_FRAME",
  "DOCUMENT_PAGE",
  "TEXT_DOCUMENT",
];

export const IMAGE_KINDS: EvidenceKind[] = ["PHOTO", "VIDEO_FRAME", "DOCUMENT_PAGE"];

export const DOC_TYPES = [
  "INSPECTION_REPORT",
  "INVOICE",
  "CONTRACTOR_STATEMENT",
  "MAINTENANCE_MESSAGE",
  "WORK_ORDER",
  "MOVE_IN_REPORT",
  "MOVE_OUT_REPORT",
  "DELIVERY_NOTE",
  "MILESTONE_REPORT",
  "OTHER_RECORD",
] as const;

// Contract bounds, in atto (MIN_HELD/MAX_HELD/MIN_BOND/MAX_BOND).
export const MIN_HELD_ATTO = ATTO_PER_GEN / 100n; // 0.01 GEN
export const MAX_HELD_ATTO = 1000n * ATTO_PER_GEN; // 1000 GEN
export const MIN_BOND_ATTO = ATTO_PER_GEN / 100n; // 0.01 GEN
export const MAX_BOND_ATTO = 100n * ATTO_PER_GEN; // 100 GEN

export const MAX_CRITERIA = 6;
export const MIN_EVIDENCE_DAYS = 1; // the contract's floor is 600 s
export const MAX_EVIDENCE_DAYS = 30;
export const MIN_CHALLENGE_HOURS = 1; // the contract's floor is 3600 s
export const MAX_CHALLENGE_HOURS = 336; // 14 days

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** The fields the form edits. */
export interface TermsDraft {
  title: string;
  subjectKind: string;
  subjectRef: string;
  claim: string;
  criteriaText: string;
  allowed: EvidenceKind[];
  respondent: string;
  inspector: string;
  heldGen: string;
  funder: string;
  bondGen: string;
  evidenceDays: string;
  challengeWindowHours: string;
  challengeEvidenceHours: string;
}

/** Fields the form does not edit, carried through a revision untouched. */
export interface TermsPassthrough {
  time_zone: string;
  window_start: string;
  deadline: string;
  required: { type: string; min: number }[];
  limitations: string[];
  follows_case: string;
}

export const DEFAULT_PASSTHROUGH: TermsPassthrough = {
  time_zone: "UTC",
  window_start: "",
  deadline: "",
  required: [],
  limitations: [],
  follows_case: "",
};

export const DEFAULT_DRAFT: TermsDraft = {
  title: "",
  subjectKind: "DELIVERY_MADE",
  subjectRef: "",
  claim: "",
  criteriaText: "",
  allowed: [...EVIDENCE_KINDS],
  respondent: "",
  inspector: "",
  heldGen: "0",
  funder: "CLAIMANT",
  bondGen: "0.01",
  evidenceDays: "3",
  challengeWindowHours: "24",
  challengeEvidenceHours: "24",
};

/** The criteria lines, trimmed, blanks dropped. */
export function criteriaList(draft: TermsDraft): string[] {
  return draft.criteriaText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isAddress(value: string): boolean {
  return ADDRESS.test(value.trim());
}

export interface ValidateOptions {
  /** The claimant's address, to check the respondent is a different wallet. */
  claimant?: string;
  /** A revision keeps its respondent, so it is not re-checked here. */
  requireRespondent?: boolean;
}

/** The first problem with the draft, in the words the contract would use. */
export function validateDraft(draft: TermsDraft, opts: ValidateOptions = {}): string {
  const title = draft.title.trim();
  if (title.length < 5) return "Give the case a title of at least 5 characters.";
  if (title.length > CONTRACT_LIMITS.title) return `The title may be at most ${CONTRACT_LIMITS.title} characters.`;

  const ref = draft.subjectRef.trim();
  if (ref.length < 2) return "Give the subject a short reference (a nickname, not contact details).";
  if (ref.length > CONTRACT_LIMITS.subjectRef) return `The subject reference may be at most ${CONTRACT_LIMITS.subjectRef} characters.`;
  if (/@|http|www\./i.test(ref)) return "The subject reference must be a nickname, not contact details or a link.";

  const claim = draft.claim.trim();
  if (claim.length < 10) return "State the claim in at least 10 characters.";
  if (claim.length > CONTRACT_LIMITS.claim) return `The claim may be at most ${CONTRACT_LIMITS.claim} characters.`;

  const crits = criteriaList(draft);
  if (crits.length < 1 || crits.length > MAX_CRITERIA) return `Give 1–${MAX_CRITERIA} criteria, one per line.`;
  if (crits.some((c) => c.length < 5)) return "Every criterion needs at least 5 characters.";
  if (crits.some((c) => c.length > CONTRACT_LIMITS.criterion)) return `A criterion may be at most ${CONTRACT_LIMITS.criterion} characters.`;
  const lowered = crits.map((c) => c.toLowerCase());
  if (new Set(lowered).size !== lowered.length) return "Two criteria say the same thing.";

  if (draft.allowed.length === 0) return "Allow at least one kind of evidence.";

  if (opts.requireRespondent !== false) {
    if (!isAddress(draft.respondent)) return "The respondent must be a wallet address (0x…).";
    if (opts.claimant && draft.respondent.trim().toLowerCase() === opts.claimant.toLowerCase()) {
      return "The respondent must be a different wallet from the claimant.";
    }
  }

  const inspector = draft.inspector.trim();
  if (inspector) {
    if (!isAddress(inspector)) return "The inspector must be a wallet address (0x…).";
    const low = inspector.toLowerCase();
    if (low === draft.respondent.trim().toLowerCase() || (opts.claimant && low === opts.claimant.toLowerCase())) {
      return "The inspector must be independent of both parties.";
    }
  }

  const held = attoFromGen(draft.heldGen || "0");
  if (held === null) return "The held sum must be a decimal amount of GEN.";
  if (held > 0n) {
    if (held < MIN_HELD_ATTO || held > MAX_HELD_ATTO) return "The held sum must be 0, or between 0.01 and 1000 GEN.";
    if (draft.funder !== "CLAIMANT" && draft.funder !== "RESPONDENT") {
      return "Say which party funds the held sum: claimant or respondent.";
    }
  }

  const bond = attoFromGen(draft.bondGen);
  if (bond === null) return "The challenge bond must be a decimal amount of GEN.";
  if (bond < MIN_BOND_ATTO || bond > MAX_BOND_ATTO) return "The challenge bond must be between 0.01 and 100 GEN.";

  const days = Number(draft.evidenceDays);
  if (!Number.isInteger(days) || days < MIN_EVIDENCE_DAYS || days > MAX_EVIDENCE_DAYS) {
    return `The evidence period must be ${MIN_EVIDENCE_DAYS}–${MAX_EVIDENCE_DAYS} whole days.`;
  }
  for (const [label, value] of [
    ["challenge window", draft.challengeWindowHours],
    ["challenge evidence period", draft.challengeEvidenceHours],
  ] as const) {
    const hours = Number(value);
    if (!Number.isInteger(hours) || hours < MIN_CHALLENGE_HOURS || hours > MAX_CHALLENGE_HOURS) {
      return `The ${label} must be ${MIN_CHALLENGE_HOURS}–${MAX_CHALLENGE_HOURS} whole hours.`;
    }
  }

  return "";
}

/** Build the `terms_json` the contract's `_terms` expects. */
export function buildTerms(
  draft: TermsDraft,
  pass: Partial<TermsPassthrough> = {},
): Record<string, unknown> {
  const merged = { ...DEFAULT_PASSTHROUGH, ...pass };
  const held = attoFromGen(draft.heldGen || "0") ?? 0n;
  const bond = attoFromGen(draft.bondGen) ?? 0n;
  return {
    title: draft.title.trim(),
    subject_kind: draft.subjectKind,
    subject_ref: draft.subjectRef.trim(),
    time_zone: merged.time_zone,
    window_start: merged.window_start,
    deadline: merged.deadline,
    claim: draft.claim.trim(),
    criteria: criteriaList(draft).map((text) => ({ text, needs_independent: false })),
    allowed: draft.allowed,
    required: merged.required,
    limitations: merged.limitations,
    respondent: draft.respondent.trim(),
    inspector: draft.inspector.trim(),
    held_sum_wei: held.toString(),
    // The contract clears the funder when nothing is held.
    funder: held > 0n ? draft.funder : "",
    challenge_bond_wei: bond.toString(),
    evidence_period_seconds: Number(draft.evidenceDays) * 86400,
    challenge_window_seconds: Number(draft.challengeWindowHours) * 3600,
    challenge_evidence_seconds: Number(draft.challengeEvidenceHours) * 3600,
    follows_case: merged.follows_case,
  };
}

/** A draft prefilled from the terms already on chain (a revision). */
export function draftFromTerms(t: Terms): TermsDraft {
  return {
    title: t.title,
    subjectKind: t.subject_kind,
    subjectRef: t.subject_ref,
    claim: t.claim,
    criteriaText: t.criteria.map((c) => c.text).join("\n"),
    allowed: [...t.allowed],
    respondent: t.respondent,
    inspector: t.inspector,
    heldGen: genFromAtto(t.held_sum_wei || "0"),
    funder: t.funder || "CLAIMANT",
    bondGen: genFromAtto(t.challenge_bond_wei),
    evidenceDays: String(Math.round(t.evidence_period_seconds / 86400)),
    challengeWindowHours: String(Math.round(t.challenge_window_seconds / 3600)),
    challengeEvidenceHours: String(Math.round(t.challenge_evidence_seconds / 3600)),
  };
}

/** The fields a revision carries through untouched. */
export function passthroughFromTerms(t: Terms): TermsPassthrough {
  return {
    time_zone: t.time_zone,
    window_start: t.window_start,
    deadline: t.deadline,
    required: t.required,
    limitations: t.limitations,
    follows_case: t.follows_case,
  };
}
