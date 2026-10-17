# Parlv

**Criteria first. Evidence on chain. Validators judge. Code settles.**

Parlv is evidence infrastructure for falsifiable disputes, built on
[GenLayer](https://genlayer.com) Studionet. Two parties freeze the criteria that
would settle a claim *before* any evidence is filed. Evidence is stored on chain
with its digest. Independent validators examine it under consensus. Deterministic
code — never a person — turns that consensus into a finding and moves any held
sum.

A finding is an assessment of evidence against agreed criteria. It is **not** a
legal determination, **not** proof that an event happened, and missing evidence
is never treated as proof of anything.

---

## Live deployment (Studionet, chain 61999)

| | |
|---|---|
| Contract | [`0x85c9bbdAe943e04e43E0ad3B560fC3Bd9041bf57`](https://explorer-studio.genlayer.com/address/0x85c9bbdAe943e04e43E0ad3B560fC3Bd9041bf57) |
| Deploy transaction | `0x9ef9256414661f145c96b18d1b01c86df45575c491ef34ac4890cf315043cae9` |
| Status / result | `FINALIZED` / `MAJORITY_AGREE` |
| Deployer | `0x4184bc5E5444F250767E8D33A49817A9B4FB0df3` |
| Source SHA-256 | `d1ff3f9c30b47308029c5d7141a275c87018e81de4675a923da2be8c0e57fe6f` |
| On-chain source SHA-256 | `d1ff3f9c30b47308029c5d7141a275c87018e81de4675a923da2be8c0e57fe6f` |

The two hashes above are equal: the source stored on chain is byte-for-byte the
source in this repository. That is not a claim in a document — it is re-checkable:

```bash
node scripts/deploy.mjs --verify
```

The machine-written record is in [`deployments/studionet.json`](deployments/studionet.json),
with the raw on-chain source and receipt under [`deployments/proofs/`](deployments/proofs).

---

## The trust model in one screen

1. **Freeze.** The claimant publishes the claim and the criteria. The respondent
   accepts *that exact version* by its digest. No moving the goalposts.
2. **File.** Both parties, and an optional independent inspector, file photographs
   and documents. The contract stores the bytes and computes their digests itself.
3. **Judge.** GenLayer validators re-examine the stored evidence against the frozen
   criteria. Consensus binds only whether each criterion is *supported* and whether
   anything could be assessed at all.
4. **Settle.** Deterministic code applies fixed floors to the result and derives the
   overall finding. The held sum moves to the claimant **only** on a final
   `SUPPORTED` finding.

Uncertainty fails closed. An assessment result is a standing decision, not
authority: funds move only after the challenge window closes and `finalize` runs.

There is no owner, no admin, no operator, and no upgrade key. That is readable
from the chain itself:

```
genlayer call <address> get_governance
```

---

## Design guarantees

Every property below is checkable against the source and the tests, not just
asserted here.

1. **It runs on today's Studionet.** The source carries the exact GenVM header and
   import idiom that Studionet's non-debug v0.2.16 GenVM accepts, and nothing else.
   See [`TOOLCHAIN.md`](TOOLCHAIN.md) for the proven pins.

2. **Every write is pinned to Studionet.** `_guard_chain()` runs first in every
   state-changing method and refuses any chain but 61999. Parlv settles real value
   under one network's consensus, so it refuses to run anywhere else.

3. **It judges any falsifiable claim.** `SUBJECT_KINDS` covers work completed,
   condition at a time, delivery made, payment made, an agreed procedure followed,
   or other — each with its own validator guidance. The claim, not the domain, is
   the unit.

4. **The contract publishes its own authority.** `get_actions(case, wallet)`
   returns what that wallet may do *right now*, computed on chain from the same
   state the writes check, each rule mirroring its write's own check in the same
   order. The frontend renders those rows directly, so it can never invent
   authority: no button the contract would refuse, no hidden path it would allow.

5. **Governance is auditable on chain.** `get_governance()` returns the empty owner
   / admin / operator, `pausable: false`, `upgradeable: false`, `has_admin_key:
   false`, `has_upgrade_key: false`, and `deployer_has_power: false`, with the
   authority statement.

6. **A shipping, verified frontend.** Next.js 15 app that signs through the user's
   own wallet, refuses non-Studionet chains before building a transaction, recomputes
   every digest from live chain state, and is type-checked, linted, and tested. The
   contract's `get_actions` keys and the app's action vocabulary are enforced to be
   identical by a parity test, so wire drift cannot ship silently.

7. **A reproducible, verified deployment.** `scripts/deploy.mjs` refuses any chain
   but 61999, refuses a source without the pinned GenVM header, deploys, waits for
   finality, and proves the on-chain source matches the repository before writing a
   machine-readable manifest. No key is ever handled, printed, or stored.

---

## Quickstart

### Contract tests (no network, no keys)

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

The Direct Mode suite deploys the contract in-process and exercises the full
lifecycle, the floors, the challenge path, settlement, governance isolation, and
the contract⇄app key parity. See [`docs/TESTING.md`](docs/TESTING.md).

### Frontend

```bash
cd web
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run smoke   # read-only check against the live Studionet contract
pnpm run dev     # http://localhost:3189
```

### Deploy / verify

```bash
node scripts/deploy.mjs --check     # validate source header + network only
node scripts/deploy.mjs             # deploy, wait for finality, verify, write manifest
node scripts/deploy.mjs --verify    # re-verify the recorded deployment
```

The deployer must be an unlocked GenLayer CLI account on Studionet. The script
never reads a private key.

---

## Repository layout

```
contracts/parlv.py        the contract (single file, dependency-free)
tests/direct/             Direct Mode contract tests (gltest)
tests/parity/             contract ⇄ frontend wire-key parity
web/                      Next.js 15 frontend (App Router, TypeScript)
scripts/deploy.mjs        deployment driver + source-SHA verifier
tools/                    advisory review tooling for a steward
deployments/              verified deployment manifest + raw proofs
probe/                    toolchain probes that established the Studionet pins
docs/                     architecture, security, deployment, testing, review guide
TOOLCHAIN.md              pinned toolchain and proven Studionet patterns
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — states, data model, consensus, floors, receipts.
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, invariants, governance guarantees.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploy, verify, and the manifest schema.
- [`docs/TESTING.md`](docs/TESTING.md) — the test suites and how to run them.
- [`docs/REVIEW_TARGET.md`](docs/REVIEW_TARGET.md) — what a reviewer should check, with exact commands.
- [`TOOLCHAIN.md`](TOOLCHAIN.md) — pinned versions and the proven Studionet idioms.

## License

ISC. See [`LICENSE`](LICENSE).

---

Studionet only (chain 61999). Everything written to Parlv is public and permanent.
