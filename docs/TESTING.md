# Testing

Parlv has three test layers. All of them run without a network and without keys.

```bash
# Contract tests (Direct Mode + parity): from the repository root
python -m pip install -r requirements-dev.txt
python -m pytest -q

# Frontend: from web/
cd web
pnpm run typecheck
pnpm run lint
pnpm run test
```

> Note: `python -m pytest` prints a `gltest` warning on stderr, which PowerShell
> reports as `Exited with code 1`. The suite result line (`78 passed`) is the
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

## 3. Frontend tests (`web/lib/*.test.ts`, Vitest)

- `acts.test.ts` — enforces contract ⇄ app action-key parity from the app side.
- `verify.test.ts` — canonical-JSON + SHA-256 digest reconstruction mirrors the
  contract, including the immutable-field set.

Plus `pnpm run typecheck` (TypeScript) and `pnpm run lint` (ESLint via
`eslint-config-next` through `FlatCompat`).

## 4. What is deliberately not tested here

- **Live consensus.** Direct Mode runs only the leader; `h.run_validator()` replays
  the captured validator closure for dissent tests. Real validator voting, quorum,
  and finality are properties of Studionet, exercised by the live deployment's
  `FINALIZED` / `MAJORITY_AGREE` receipt.
- **Network availability.** The chain gate is asserted statically and behaviourally,
  but a live outage is not simulated.

## 5. Reproducing the count

```bash
python -m pytest -q          # 78 passed
cd web && pnpm run test      # 6 passed
```
