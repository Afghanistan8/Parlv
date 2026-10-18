import { describe, expect, it } from "vitest";
import type { Terms } from "./types";
import {
  DEFAULT_DRAFT,
  type TermsDraft,
  buildTerms,
  criteriaList,
  draftFromTerms,
  passthroughFromTerms,
  validateDraft,
} from "./terms";

const CLAIMANT = "0x1111111111111111111111111111111111111111";
const RESPONDENT = "0x2222222222222222222222222222222222222222";

function draft(over: Partial<TermsDraft> = {}): TermsDraft {
  return {
    ...DEFAULT_DRAFT,
    title: "Kitchen refit final inspection",
    subjectRef: "Flat 4B kitchen",
    claim: "The refit was completed and the final payment is due.",
    criteriaText: "The work was completed\nIt was completed by the deadline",
    respondent: RESPONDENT,
    ...over,
  };
}

describe("criteriaList", () => {
  it("splits lines, trims, drops blanks", () => {
    expect(criteriaList(draft({ criteriaText: " one \n\n two \n" }))).toEqual(["one", "two"]);
  });
});

describe("buildTerms", () => {
  it("produces the shape the contract's _terms reads", () => {
    const t = buildTerms(draft());
    expect(t.title).toBe("Kitchen refit final inspection");
    expect(t.subject_kind).toBe("DELIVERY_MADE");
    expect(t.criteria).toEqual([
      { text: "The work was completed", needs_independent: false },
      { text: "It was completed by the deadline", needs_independent: false },
    ]);
    expect(t.respondent).toBe(RESPONDENT);
    expect(t.required).toEqual([]);
    expect(t.limitations).toEqual([]);
    expect(t.evidence_period_seconds).toBe(3 * 86400);
  });

  it("clears the funder when nothing is held", () => {
    const t = buildTerms(draft({ heldGen: "0", funder: "RESPONDENT" }));
    expect(t.held_sum_wei).toBe("0");
    expect(t.funder).toBe("");
  });

  it("converts a held sum and bond to exact atto", () => {
    const t = buildTerms(draft({ heldGen: "0.05", funder: "CLAIMANT", bondGen: "0.01" }));
    expect(t.held_sum_wei).toBe("50000000000000000");
    expect(t.funder).toBe("CLAIMANT");
    expect(t.challenge_bond_wei).toBe("10000000000000000");
  });

  it("carries the pass-through fields a revision keeps", () => {
    const t = buildTerms(draft(), {
      follows_case: "PR-0001",
      required: [{ type: "PHOTO", min: 2 }],
      limitations: ["Indoor conditions only"],
    });
    expect(t.follows_case).toBe("PR-0001");
    expect(t.required).toEqual([{ type: "PHOTO", min: 2 }]);
    expect(t.limitations).toEqual(["Indoor conditions only"]);
  });
});

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(draft(), { claimant: CLAIMANT })).toBe("");
  });
  it("catches the mistakes the contract refuses", () => {
    expect(validateDraft(draft(), { claimant: RESPONDENT })).toMatch(/different wallet/);
    expect(validateDraft(draft({ title: "no" }))).toMatch(/at least 5/);
    expect(validateDraft(draft({ claim: "short" }))).toMatch(/at least 10/);
    expect(validateDraft(draft({ criteriaText: "The wall was painted\nTHE WALL WAS PAINTED" }))).toMatch(/same thing/);
    expect(validateDraft(draft({ criteriaText: "ab" }))).toMatch(/at least 5/);
    expect(validateDraft(draft({ criteriaText: "" }))).toMatch(/1–6 criteria/);
    expect(validateDraft(draft({ allowed: [] }))).toMatch(/at least one kind/);
    expect(validateDraft(draft({ respondent: "0xnope" }))).toMatch(/wallet address/);
    expect(validateDraft(draft({ heldGen: "abc" }))).toMatch(/decimal/);
    expect(validateDraft(draft({ heldGen: "0.001" }))).toMatch(/between 0.01 and 1000/);
    expect(validateDraft(draft({ heldGen: "0.05", funder: "" }))).toMatch(/which party funds/);
    expect(validateDraft(draft({ bondGen: "0.001" }))).toMatch(/between 0.01 and 100/);
    expect(validateDraft(draft({ evidenceDays: "40" }))).toMatch(/evidence period/);
    expect(validateDraft(draft({ challengeWindowHours: "0" }))).toMatch(/challenge window/);
    expect(validateDraft(draft({ inspector: RESPONDENT }))).toMatch(/independent/);
  });
  it("does not re-check the respondent on a revision", () => {
    expect(validateDraft(draft({ respondent: "0xnope" }), { requireRespondent: false })).toBe("");
  });
});

describe("draftFromTerms", () => {
  const onChain: Terms = {
    rules: "parlv-rules-1",
    title: "Kitchen refit final inspection",
    subject_kind: "WORK_COMPLETED",
    subject_ref: "Flat 4B kitchen",
    time_zone: "Europe/London",
    window_start: "",
    deadline: "",
    claim: "The refit was completed and the final payment is due.",
    criteria: [
      { id: "C1", text: "The work was completed", needs_independent: false },
      { id: "C2", text: "It was completed by the deadline", needs_independent: false },
    ],
    allowed: ["PHOTO", "TEXT_DOCUMENT"],
    required: [{ type: "PHOTO", min: 1 }],
    limitations: ["Indoor conditions only"],
    claimant: CLAIMANT,
    respondent: RESPONDENT,
    inspector: "",
    held_sum_wei: "50000000000000000",
    funder: "CLAIMANT",
    challenge_bond_wei: "10000000000000000",
    evidence_period_seconds: 259200,
    challenge_window_seconds: 86400,
    challenge_evidence_seconds: 86400,
    follows_case: "PR-0001",
    version: 2,
    case_id: "PR-0002",
    published_at: "2026-01-01T00:00:00Z",
    digest: "abc",
  };

  it("prefills every editable field from the terms on chain", () => {
    const d = draftFromTerms(onChain);
    expect(d.title).toBe(onChain.title);
    expect(d.subjectKind).toBe("WORK_COMPLETED");
    expect(d.criteriaText).toBe("The work was completed\nIt was completed by the deadline");
    expect(d.allowed).toEqual(["PHOTO", "TEXT_DOCUMENT"]);
    expect(d.heldGen).toBe("0.05");
    expect(d.bondGen).toBe("0.01");
    expect(d.evidenceDays).toBe("3");
    expect(d.challengeWindowHours).toBe("24");
  });

  it("rebuilds terms that match the ones it read", () => {
    const back = buildTerms(draftFromTerms(onChain), passthroughFromTerms(onChain));
    expect(back.title).toBe(onChain.title);
    expect(back.subject_kind).toBe(onChain.subject_kind);
    expect(back.claim).toBe(onChain.claim);
    expect(back.allowed).toEqual(onChain.allowed);
    expect(back.respondent).toBe(onChain.respondent);
    expect(back.held_sum_wei).toBe(onChain.held_sum_wei);
    expect(back.funder).toBe(onChain.funder);
    expect(back.challenge_bond_wei).toBe(onChain.challenge_bond_wei);
    expect(back.follows_case).toBe(onChain.follows_case);
    expect(back.required).toEqual(onChain.required);
    expect(back.limitations).toEqual(onChain.limitations);
    expect(back.time_zone).toBe(onChain.time_zone);
    expect(back.evidence_period_seconds).toBe(onChain.evidence_period_seconds);
    expect((back.criteria as { text: string }[]).map((c) => c.text)).toEqual(
      onChain.criteria.map((c) => c.text),
    );
  });
});
