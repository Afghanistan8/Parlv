/** Chain-state shapes. Every type mirrors a contract view's JSON. */

export type Role = "CLAIMANT" | "RESPONDENT" | "INSPECTOR";
export type State =
  | "DRAFT" | "OPEN" | "DETERMINED" | "UNDER_CHALLENGE"
  | "FINAL" | "DECLINED" | "WITHDRAWN" | "EXPIRED" | "LAPSED";
export type Finding =
  | "SUPPORTED" | "NOT_ESTABLISHED" | "CONFLICTING" | "INSUFFICIENT" | "NOT_ASSESSED";
export type EvidenceKind = "PHOTO" | "VIDEO_FRAME" | "DOCUMENT_PAGE" | "TEXT_DOCUMENT";

export interface Criterion {
  id: string;
  text: string;
  needs_independent: boolean;
}

export interface Terms {
  rules: string;
  title: string;
  subject_kind: string;
  subject_ref: string;
  time_zone: string;
  window_start: string;
  deadline: string;
  claim: string;
  criteria: Criterion[];
  allowed: EvidenceKind[];
  required: { type: string; min: number }[];
  limitations: string[];
  claimant: string;
  respondent: string;
  inspector: string;
  held_sum_wei: string;
  funder: string;
  challenge_bond_wei: string;
  evidence_period_seconds: number;
  challenge_window_seconds: number;
  challenge_evidence_seconds: number;
  follows_case: string;
  version: number;
  case_id: string;
  published_at: string;
  digest: string;
}

export interface Case {
  case_id: string;
  state: State;
  claimant: string;
  respondent: string;
  inspector: string;
  inspector_accepted: boolean;
  version: number;
  accepted_version: number;
  accepted_digest: string;
  funded_wei: string;
  created_at: string;
  updated_at: string;
  draft_expires_at: string;
  opened_at: string;
  evidence_deadline: string;
  ready: Record<Role, boolean>;
  decisions: string[];
  standing: string;
  challenge: Challenge | null;
  retries_used: number;
  retried_by: string[];
  settlement: Settlement | null;
  closed_reason: string;
  evidence_ids?: string[];
}

export interface Challenge {
  by: string;
  by_address: string;
  reason: string;
  bond_wei: string;
  opened_at: string;
  decision_challenged: string;
  evidence_ends: string;
  reply_ends: string;
  close_after: string;
  outcome: string;
  bond_to: string;
  rounds: number;
  network_fault: boolean;
  closed_at?: string;
}

export interface Settlement {
  held_sum_wei: string;
  to_role: string;
  to: string;
  why: string;
  at: string;
}

export interface Evidence {
  evidence_id: string;
  case_id: string;
  kind: EvidenceKind;
  role: Role;
  filed_by: string;
  filed_at: string;
  sha256: string;
  bytes: number;
  doc_type?: string;
  title?: string;
  description?: string;
  file_name?: string;
  declared_capture?: string;
  redacted?: boolean;
  redaction_note?: string;
  frame_time?: string;
  criteria?: string[];
  during_challenge?: boolean;
  reuse?: string;
  first_filed_in?: string;
}

export interface DecisionCriterion {
  id: string;
  text: string;
  needs_independent: boolean;
  finding: Finding;
  model_finding: string;
  floors: string[];
  basis: string[];
  contrary: string[];
  missing: string[];
  rationale: string;
}

export interface Decision {
  decision_id: string;
  case_id: string;
  round: number;
  kind: string;
  scope: string;
  terms_version: number;
  terms_digest: string;
  manifest_digest: string;
  criteria: DecisionCriterion[];
  overall: Finding;
  limitations: string[];
  instructions_found: string[];
  seen_ids: string[];
  unseen_ids: string[];
  status: string;
  decided_at: string;
  requested_by: string;
  challenge_window_ends: string;
  decision_digest: string;
  supersedes?: string;
  superseded_by?: string;
}

export interface Can {
  ok: boolean;
  why: string;
}

export interface Acts {
  role: Role | "";
  revise: Can;
  accept: Can;
  decline: Can;
  withdraw_case: Can;
  accept_inspector: Can;
  fund: Can;
  expire: Can;
  file: Record<EvidenceKind, Can>;
  ready: Can;
  assess: Can;
  lapse: Can;
  challenge: Can;
  readjudicate: Can;
  close_challenge: Can;
  finalize: Can;
  withdraw: Can;
}
