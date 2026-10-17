# Review target

This is a guide for an independent steward: the exact things to check, and the
exact commands to check them with. Nothing here asks you to trust the authors.

## 0. One-minute orientation

- Contract: [`contracts/parlv.py`](../contracts/parlv.py) — one file, no runtime
  dependencies beyond the pinned GenVM std.
- Frontend: [`web/`](../web) — Next.js 15, TypeScript.
- Deploy driver: [`scripts/deploy.mjs`](../scripts/deploy.mjs).
- Deployment of record: `0x85c9bbdAe943e04e43E0ad3B560fC3Bd9041bf57` on Studionet
  (chain 61999).

## 1. Does the running contract match this repository?

```bash
node scripts/deploy.mjs --verify
```

Expect `verified true` and a `source sha256` equal to `onchain sha256`. If they
disagree, the script exits non-zero. You can also check independently:

```bash
genlayer code 0x85c9bbdAe943e04e43E0ad3B560fC3Bd9041bf57 | sha256sum
```

The on-chain source is also stored verbatim at
`deployments/proofs/studionet-0x639D….genlayer.py`.

## 2. Is it really Studionet-only?

```bash
grep -n "_guard_chain" contracts/parlv.py
python -m pytest tests/direct/test_receipt.py -q -k chain
python -m pytest tests/direct/test_smoke.py   -q -k chain
```

`_guard_chain()` must be the first statement of every `@gl.public.write` method, and
the static test `test_every_write_guards_the_chain` asserts that from the source.

## 3. Is there really no owner, admin, or upgrade path?

```bash
genlayer call 0x85c9bbdAe943e04e43E0ad3B560fC3Bd9041bf57 get_governance
python -m pytest tests/direct/test_governance.py tests/direct/test_receipt.py -q
```

Expect the governance view to report empty owner/admin/operator, no pause, no
upgrade, no admin or upgrade key, and `deployer_has_power: false`. The tests assert
that no write consults a stored key (`test_every_write_gate_is_a_role_from_the_frozen_terms`)
and that the deployer cannot move held funds.

## 4. Can a party win on its own evidence alone?

```bash
python -m pytest tests/direct/test_assessment.py -q -k "floors or f2 or self"
python -m pytest tests/direct/test_invariants.py -q -k self_certification
python -m pytest tests/direct/test_hardening.py -q -k "reuse or injection"
```

The floors (**F3**, **F2**, **F6/F7**) must demote a finding to `CONFLICTING` /
`INSUFFICIENT` wherever a conclusive finding would rest only on the favoured side's
own evidence, or on reused or injection-flagged items.

## 5. Does anything but SUPPORTED pay the claimant?

```bash
python -m pytest tests/direct/test_hardening.py -q -k "pays or pay the claimant"
python -m pytest tests/direct/test_invariants.py -q -k "books or strands"
```

`finalize` pays only on a final `SUPPORTED`; every other outcome releases to the
funder; all movement is pull-based so nothing is stranded.

## 6. Can the frontend invent authority the contract would refuse?

```bash
python -m pytest tests/parity/test_parity.py -q
cd web && pnpm run test && pnpm run typecheck && pnpm run lint
```
Parity tests fail if the contract's `get_actions` keys and the app's vocabulary
diverge. The app renders affordances from `get_actions` and refuses non-Studionet
chains before building any transaction.

## 7. Are the toolchain pins real?

```bash
cat TOOLCHAIN.md
python -m pytest tests/direct/test_receipt.py -q -k "runner or source"
```

The header must be exactly `# v0.2.16` then the `py-genlayer:132536…` Depends line;
the source must be ASCII with LF line endings. Both are asserted statically.

## 8. Advisory automated review

```bash
node tools/adversarial_review.mjs
```

This script walks the repository and flags (a) any write not guarded by
`_guard_chain`, (b) any write authorising from a value other than a frozen-terms
role, (c) any sign of a pause/upgrade/admin/owner surface, (d) any drift between the
contract's action keys and the app's, and (e) any model/assistant attribution in
committed text. It prints findings and exits non-zero on a hard failure. It is a
convenience, not a substitute for the tests.

## 9. Design guarantees

The seven guarantees in [`README.md`](../README.md#design-guarantees) are each
checkable from this repository: the pinned GenVM header (`TOOLCHAIN.md`, and the
static source tests), the chain gate on every write (section 2), the
`SUBJECT_KINDS` generalization (`get_config` and `test_smoke.py`), the on-chain
`get_actions` authority map (section 6), the `get_governance` view (section 3), the
verified frontend (section 6), and the verified deployment (section 1).

## 10. Reporting a finding

Open an issue with a minimal reproduction. The strongest report is a failing test
against `tests/direct/` plus the exact command that shows the divergence.
