# Testing

Parlv has four test layers. The first three run without a network and without
keys; the fourth reads the live deployment and needs only an internet connection.

```bash
# Contract tests (Direct Mode + parity): from the repository root
python -m pip install -r requirements-dev.txt
python -m pytest -q

# Frontend: from web/
cd web
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run smoke      # one read-only check against the live Studionet contract
```

> Note: `python -m pytest` prints a `gltest` warning on stderr, which PowerShell
> reports as `Exited with code 1`. The suite result line (`85 passed`) is the
> authoritative outcome.

## 1. Direct Mode contract tests (`tests/direct/`)

These deploy the **real** contract against the **real** v0.2.16 SDK the network
runs. The harness (`conftest.py`) reproduces the network's money semantics
(payable credit, `EthSend` debits, `inbalance` on unfunded sends), drives time with
`vm.warp`, and serves model answers from a queue. Identical bytes are matched by
the harness exactly as the contract links twins.

| File | Focus |
|---|---|
| `test_smoke.py` | config, chain gate, open/accept/decline/withdraw, expire, inspector, funding |
| `test_evidence.py` | digests over stored bytes, text line breaks, who may file, image rules, caps, duplicates, cross-case reuse, deadlines, readiness |
| `test_assessment.py` | supported end to end, code-decided missing/empty, floor demotion, F2 independent basis, retry when unseen, guards |
| `test_actions.py` | the `get_actions` gate map for draft/open/fund/finalize, and off-chain refusal |
| `test_challenge.py` | challenge needs new evidence + bond, failed bond → opponent, close without evidence returns the bond, single challenge, double finalize/withdraw refused |
| `test_receipt.py` | receipt digest recomputes, receipt before decision refused, canary PNG, PNG metadata refused, source is ASCII+LF, runner pin header, storage/method name disjointness, every write guards the chain, payable writes refuse by returning, no operator backdoor, chain constant |
| `test_invariants.py` | balance books equality, failed transfer never strands value, no self-certification paths, lapse returns the deposit, counter consistency |
| `test_governance.py` | governance view reports no authority, deployer recorded but powerless, no pause/upgrade/admin methods, every write gate is a frozen-terms role, deployer cannot move held funds, stats/config agree |
| `test_hardening.py` | digest freeze/recompute, criteria-id injection, stored-bytes digest, duplicate filing, cross-counterparty reuse, manifest reuse, prompt injection, settlement fail-closed, supported pays claimant |

`model.py` holds harness helpers (canary PNG codec, queued-answer helpers).

## 2. Parity tests (`tests/parity/`)

`test_parity.py` is a real parity check, not a smoke test. It extracts the action
gate keys from three places and asserts they are identical:

- `contracts/parlv.py` — the keys `get_actions` emits;
- `web/lib/types.ts` — the app's `Acts` type;
- `web/app/cases/[id]/page.tsx` — the case page's rendered gates.

It also asserts every write has a mapped gate, the case page reads only real gates
and renders every critical one, `get_actions` emits every mapped gate, and every
gate reason is a user-facing sentence. This is what makes wire drift a build
failure instead of a silent runtime bug.

It additionally pins two things a steward flagged:

- **Every write has a path in the console.** `test_every_write_is_reachable_from_the_client`
  walks `web/app`, `web/lib` and `web/components` and fails if any of the 18 writes is
  never called from app source, and `test_no_action_button_is_a_dead_end` fails if a
  rendered `Can` affordance has no handler (a "Revise terms" button that did nothing
  is exactly the defect this catches).
- **The digest the browser rebuilds is the digest the contract wrote.**
  `tests/parity/canonical.py` holds the parity cases and the exact `_canon`
  expression; `tests/parity/fixtures/canonical.json` is the committed fixture; and
  `web/lib/verify.test.ts` reads that same fixture and must reproduce every
  `canonical` string and `sha256`. The cases cover non-ASCII text, astral
  characters, code-point key ordering, control characters and a lone surrogate.

## 3. Frontend tests (`web/lib/*.test.ts`, `web/components/*.test.tsx`, Vitest)

- `lib/acts.test.ts` — enforces contract ⇄ app action-key parity from the app side.
- `lib/verify.test.ts` — canonical-JSON + SHA-256 digest reconstruction mirrors the
  contract, including `ensure_ascii=True` escaping, code-point key ordering and the
  immutable-field set. It replays the shared
  [`tests/parity/fixtures/canonical.json`](../tests/parity/fixtures/canonical.json)
  fixture case by case, so a byte-level divergence from Python fails here.
- `lib/amount.test.ts` — GEN ⇄ atto through BigInt: exact at 18 decimals, no float
  in the path, and junk rejected.
- `lib/terms.test.ts` — the terms builder and its client-side pre-validation mirror
  `_terms` (bounds, duplicate criteria, respondent/inspector independence, held-sum
  and bond ranges), and a draft made from chain terms rebuilds those terms.
- `lib/client.test.ts` — pins the read path: `view` must request the
  `latest-final` transaction-hash variant and must parse the contract's
  JSON-string return.
- `lib/errors.test.ts` — a contract refusal is recognised, a transport failure is not.
- `components/Wallet.test.tsx` — the wallet layer discovers **every** announced
  EIP-6963 wallet, lists them so the user chooses, and connects to the one picked
  (not the first to announce). This is the regression guard for the app locking
  itself to a single wallet.

Plus `pnpm run typecheck` (TypeScript) and `pnpm run lint` (ESLint via
`eslint-config-next` through `FlatCompat`).

## 4. Live smoke test (`web/scripts/live-smoke.mjs`)

`pnpm run smoke` reads the **deployed** contract through the same client path the
browser uses and asserts the invariants the app depends on: `get_config` returns
this app's rules id on chain 61999, `get_governance` reports no admin key, no
upgrade key, and no deployer power, and `list_cases` returns a page. It exits
non-zero on any failure.

It is the test that catches read-path drift: it uses
`transactionHashVariant: "latest-final"`, because the `genlayer-js` default
(`"latest-nonfinal"`) is rejected by this RPC with an HTML error page. That
difference is invisible to the unit tests and only shows up against the network.

## 5. What is deliberately not tested here

- **Live consensus.** Direct Mode runs only the leader; `h.run_validator()` replays
  the captured validator closure for dissent tests. Real validator voting, quorum,
  and finality are properties of Studionet, exercised by the live deployment's
  `FINALIZED` / `MAJORITY_AGREE` receipt.
- **Network availability.** The chain gate is asserted statically and behaviourally,
  but a live outage is not simulated.
- **Signed writes from a browser wallet.** No automated browser has a funded
  Studionet wallet, so the write path is exercised up to the pre-sign gates
  (no provider, wrong chain) and the contract's own write tests; the final
  signature is a real wallet action by design.

## 6. Reproducing the counts

```bash
python -m pytest -q          # 85 passed (13 of them parity)
cd web && pnpm run test      # 34 passed (7 files)
cd web && pnpm run smoke     # 6/6 checks passed (live)
```
