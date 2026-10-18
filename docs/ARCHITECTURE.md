# Parlv architecture

Parlv is one dependency-free Python contract and one Next.js app. The contract is
the system of record: it stores evidence bytes, computes digests, runs the
assessment under GenLayer consensus, applies the floors, and settles any held sum.
The app is a view and a signer — it can build a transaction but it can never
invent authority the contract would refuse.

- Contract: [`contracts/parlv.py`](../contracts/parlv.py)
- Frontend: [`web/`](../web)
- Deploy driver: [`scripts/deploy.mjs`](../scripts/deploy.mjs)

---

## 1. Case lifecycle

```
         open_case            accept_case            fund_case
   ───────────────────▶ DRAFT ───────────▶ DRAFT ──────────────▶  (held sum)
   (claim + criteria)     │  (respondent accepts by digest)        │
                          │                                        ▼
        revise_terms ◀────┘                                     OPEN
        (claimant only,                                       │    │
         before accept)                                       │    │ submit_image / submit_text
                                                              │    │ mark_ready
                                                              ▼    ▼
                                                    request_assessment
                                                              │
                              ┌───────────────────────────────┴──────────────┐
                              ▼                                              ▼
        missing required / nothing filed                      validators assess
              (decided in code)                              (consensus panel)
                              └───────────────┬──────────────────────────────┘
                                              ▼
                                          DETERMINED  ──────────────▶  finalize
                                          (standing                  (after the
                                           decision)                  challenge window)
                                              │
                                    challenge │ (the side it went against)
                                              ▼
                                     UNDER_CHALLENGE ──▶ readjudicate ──▶ close_challenge
                                              │
                                     (or withdraw/cancel paths)
```

Terminal states: `FINAL`, `DECLINED`, `WITHDRAWN`, `EXPIRED`, `LAPSED`.

### Write surface

| Method | Who | What it does |
|---|---|---|
| `open_case(terms_json)` | anyone (becomes claimant) | drafts a case with frozen criteria |
| `revise_terms(cid, terms_json)` | claimant, pre-acceptance | new terms version (≤ `MAX_VERSIONS`) |
| `accept_case(cid, terms_digest)` | named respondent | accepts an exact version by digest |
| `decline_case(cid, reason)` | named respondent | declines a draft |
| `withdraw_case(cid)` | claimant, pre-open | withdraws a draft |
| `accept_inspector(cid, terms_digest)` | named inspector | accepts the inspector role |
| `fund_case(cid)` | named funder | deposits the held sum (payable) |
| `expire_case(cid)` | anyone | closes an expired draft |
| `submit_image(cid, meta_json, data)` | party / accepted inspector | files image bytes (contract hashes them) |
| `submit_text(cid, meta_json, text)` | party / accepted inspector | files a text document |
| `mark_ready(cid)` | party / accepted inspector | declares your evidence complete |
| `lapse_case(cid)` | anyone | closes an open case nobody advanced |
| `request_assessment(cid)` | party | asks validators to assess |
| `challenge(cid, reason)` | side it went against | opens a challenge (payable bond) |
| `readjudicate(cid)` | anyone | re-runs the panel on new evidence |
| `close_challenge(cid)` | anyone | closes the challenge, settles the bond |
| `finalize(cid)` | anyone | settles the held sum after the window |
| `withdraw()` | any credit holder | pulls owed credit (no stranded value) |

### Read surface

`get_config`, `get_stats`, `get_governance`, `get_case`, `get_actions`,
`get_terms`, `list_cases`, `cases_of`, `get_evidence`, `get_evidence_text`,
`get_evidence_image`, `get_case_evidence`, `get_decision`, `get_events`,
`get_credit`, `get_receipt`.

---

## 2. Frozen terms

`open_case` parses and bounds a `terms_json` document (`_terms`). The respondent
accepts `terms_digest`, a SHA-256 over the canonical JSON of the accepted version.
Once accepted, the terms cannot change; `revise_terms` is refused after
acceptance. This is the anti-goalpost-moving guarantee: every later step — filing,
assessment, settlement — reads the *accepted* version (`_accepted_terms`), never
the latest.

Terms carry: `title`, `subject_kind` (one of `SUBJECT_KINDS`), `subject_ref`,
`time_zone`, `claim`, `criteria[]` (≤ `MAX_CRITERIA`, each optionally
`needs_independent`), `allowed` evidence kinds, `respondent`, an optional
`inspector`, an optional `held_sum_wei` with a `funder`, a `challenge_bond_wei`,
the evidence window, and the challenge window.

---

## 3. Evidence

Evidence is stored, not referenced. `submit_image` takes raw bytes and a metadata
JSON; the contract computes the SHA-256 itself, validates the image (PNG/JPEG
magic, side bounds, byte cap), and stores `evidence_bytes` keyed by evidence id.
`submit_text` stores bounded text. Filers do not supply a digest — the contract
derives it, so a filer cannot lie about what they filed.

Per-role caps apply (`CAPS`, and `CHALLENGE_CAPS` during a challenge). Identical
bytes filed by different roles are linked as `twins`: the same bytes are "seen
together" during assessment, so which copy a model cites does not decide whose
evidence it is.

---

## 4. Assessment under consensus

`request_assessment` (and `readjudicate`) call `_run_assessment`:

1. **Code first.** If required evidence is missing, or nothing was filed at all,
   no validator is asked. The result is `INSUFFICIENT` with floor
   `REQUIRED_MISSING` / `NOTHING_FILED`, recorded as a `CODE` decision. Missing
   evidence is never proof of anything.
2. **The panel.** Otherwise `_panel` runs `gl.vm.run_nondet(leader, validator)`.
   The leader examines each image (a sighted calibration step first), then judges
   each criterion. Every validator re-runs the *same* assessment itself.

### What consensus binds

`_dissent` decides whether a validator can stand behind the leader's result. It
compares only `_bound(settled, ids)` — for every criterion, whether it is
`SUPPORTED`, and whether the overall finding is `NOT_ASSESSED` (nothing assessable).
Wording, cited ids, and the finer labels (`NOT_ESTABLISHED`, `CONFLICTING`,
`INSUFFICIENT`) are **not** compared: they turn on which items a model cites, and
honest models differ. They are recorded as the leader's reading, and the decision
record says so in `bound`.

A validator also refuses the leader's result if:
- the leader's result does not judge every criterion (`_judged`), or is malformed;
- the leader claims to have seen images that are not on the case;
- the leader fails to count images this node saw (copies count together);
- the leader's flag list on evidence that tried to instruct the assessor
  (`instructions_found`) changes what the record binds.

### The floors (F0–F8)

After shaping, `_settle_criterion` applies fixed, deterministic floors to each
criterion. A floor can only move a finding *toward* `INSUFFICIENT` /
`CONFLICTING`, never toward `SUPPORTED`.

| Floor | Trigger | Effect |
|---|---|---|
| `F0` | label outside the vocabulary | → `INSUFFICIENT` |
| `F5` | cites an item this node did not see or read | dropped from the citation |
| `F6`/`F7` | cites an item that tried to instruct the assessor, or bytes reused across cases with a different counter-party | dropped for the side it would favour |
| `F4` | conclusive finding with `evidence_adequate != true` | → `INSUFFICIENT` |
| `F1` | conclusive finding with an empty basis | → `INSUFFICIENT` |
| `F8` | `CONFLICTING` with only one side present | → `INSUFFICIENT` |
| `F2` | criterion `needs_independent` and no inspector item in the basis | → `INSUFFICIENT` |
| `F3` | the favoured side's own evidence alone, with opposing evidence present | → `CONFLICTING` |

`NONE_SEEN` is recorded when nothing was visible to the node at all (`NOT_ASSESSED`).

### Overall finding

`_overall`: any `NOT_ASSESSED` ⇒ `NOT_ASSESSED`; all `SUPPORTED` ⇒ `SUPPORTED`;
else any `NOT_ESTABLISHED` ⇒ `NOT_ESTABLISHED`; else any `CONFLICTING` ⇒
`CONFLICTING`; else `INSUFFICIENT`.

---

## 5. Decisions and receipts

Each decision (`_record`) is immutable except for `status`, `supersedes`,
`superseded_by`, `challenge_window_ends`, and `decision_digest`. It carries:

- `manifest_digest` — over the frozen evidence snapshot (id, kind, role, sha256,
  filed_at, declared capture, reuse flags);
- per-criterion `finding`, `model_finding`, `floors`, `basis`, `contrary`,
  `missing`, `rationale`;
- `seen_ids` / `unseen_ids` (which images were examined — this drives the retry
  right);
- `observations`, `limitations`, `instructions_found`;
- `bound` — a plain-language statement of exactly what consensus bound;
- `decision_digest` — over the whole record, mirrored by the app's verifier.

`get_receipt(cid)` bundles the accepted terms, the evidence manifest, the
standing decision, and the settlement state into one recomputable object
(`parlv.receipt/1`). See [`web/lib/verify.ts`](../web/lib/verify.ts) for the exact
canonical-JSON + SHA-256 reconstruction the app uses, which mirrors the contract's
`_canon`.

---

## 6. Challenge and settlement

- **Challenge.** Only the side the decision went against may `challenge`, within
  the challenge window, by posting the challenge bond. The challenger then files
  new evidence; the other side may answer; then anyone may `readjudicate` (≤
  `MAX_READJUDICATIONS`).
- **Bond.** `_settle_bond` returns the bond to the challenger if the readjudication
  reverses which side the decision favours, or if no readjudication was recorded in
  time; otherwise the bond goes to the other side.
- **Finalize.** `finalize` moves the held sum to the claimant **only** if the
  standing decision's overall finding is `SUPPORTED`. Any other outcome releases
  the held sum back to the funder. Settlement fails closed.
- **Credits.** All value movement is pull-based through `withdraw()`; the contract
  tracks `owed`/`paid` per address, so nothing is stranded.

---

## 7. No governance

`get_governance()` returns empty owner/admin/operator, `pausable: false`,
`upgradeable: false`, `has_admin_key: false`, `has_upgrade_key: false`,
`deployer_has_power: false`. The deployer is recorded for provenance and consulted
by nothing. The only global gate is `_guard_chain`, and it only pins the network to
Studionet. Every write authorises purely from the roles named in the frozen terms.

---

## 8. Frontend architecture

```
web/app/page.tsx              landing / trust model
web/app/cases/page.tsx        case list (list_cases)
web/app/cases/new/page.tsx    draft a case, with an optional held sum (open_case)
web/app/cases/[id]/page.tsx   case detail: acts, evidence, decisions, settlement
web/app/verify/page.tsx       recompute digests from live chain state (get_receipt)
web/app/status/page.tsx       network + contract status (get_config / get_stats)
web/components/Wallet.tsx     EIP-1193 wallet connect, chain guard
web/components/TermsFields.tsx  the editable terms, shared by create and revise
web/components/ReviseTerms.tsx  a new terms version (revise_terms)
web/components/TextEvidence.tsx typed document evidence (submit_text)
web/lib/client.ts             read client + write client (account + provider)
web/lib/config.ts             chain/RPC/contract pins, limits, assertStudionet
web/lib/types.ts              wire types (Acts, decision, receipt)
web/lib/terms.ts              build + pre-validate terms_json, money bounds
web/lib/amount.ts             GEN ⇄ atto, exact through BigInt
web/lib/verify.ts             canonical JSON + SHA-256, mirrors the contract
web/lib/image.ts              image → bytes arg for submit_image
web/lib/acts.test.ts          contract ⇄ app action-key parity
web/lib/verify.test.ts        digest reconstruction, incl. the shared ASCII fixture
```

The app builds a write client with the connected account **and** provider, so
`writeContract` signs through the user's wallet. Before building any transaction it
checks `chainId === 61999` (`assertStudionet`). It renders action buttons from the
contract's own `get_actions`, so the UI cannot offer an act the contract would
refuse. **Every write in the table in §1 is reachable from the console** —
including `fund_case`, `revise_terms`, `submit_text`, `expire_case` and
`lapse_case` — and `tests/parity/test_parity.py` fails the build if a write loses
its path or a rendered action loses its handler. It also fails if the contract's
action keys and the app's vocabulary diverge, as does `web/lib/acts.test.ts`.
