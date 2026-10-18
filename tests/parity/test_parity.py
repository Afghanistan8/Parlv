"""App-contract parity: the frontend's action gates must mirror get_actions.

The web app renders `get_actions` directly (it never reimplements the rules),
so the wire keys the contract emits and the keys the app reads must be the
same. This test extracts BOTH sets from source and asserts they agree, so a
rename on either side fails here instead of silently hiding a button. A hidden
button is a security-relevant defect: a user who cannot see "Withdraw case" or
"Close challenge" cannot exercise the right the contract grants them.
"""

import json
import re
from pathlib import Path

from .canonical import CASES, CONTRACT_CALL, FIXTURE, build_fixture, canon, digest

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "parlv.py"
TYPES = ROOT / "web" / "lib" / "types.ts"
CASE_PAGE = ROOT / "web" / "app" / "cases" / "[id]" / "page.tsx"
VERIFY_TS = ROOT / "web" / "lib" / "verify.ts"
NEW_CASE_PAGE = ROOT / "web" / "app" / "cases" / "new" / "page.tsx"

# write method -> get_actions gate key (None = no gate; the case does not exist yet)
WRITE_TO_GATE = {
    "open_case": None,
    "revise_terms": "revise",
    "accept_case": "accept",
    "decline_case": "decline",
    "withdraw_case": "withdraw_case",
    "accept_inspector": "accept_inspector",
    "fund_case": "fund",
    "expire_case": "expire",
    "submit_image": "file",
    "submit_text": "file",
    "mark_ready": "ready",
    "lapse_case": "lapse",
    "request_assessment": "assess",
    "challenge": "challenge",
    "readjudicate": "readjudicate",
    "close_challenge": "close_challenge",
    "finalize": "finalize",
    "withdraw": "withdraw",
}

# Gates that decide money or finality. If any of these disappears from the app
# the defect is serious enough to name explicitly.
CRITICAL_GATES = (
    "assess", "challenge", "readjudicate", "close_challenge", "finalize", "withdraw",
)


def contract_gate_keys() -> set:
    """The key set of the dict _acts_for returns."""
    s = CONTRACT.read_text(encoding="ascii")
    m = re.search(r"return \{\"role\": role,.*?\}", s, re.S)
    assert m, "get_actions return dict not found"
    return set(re.findall(r'"(\w+)"\s*:', m.group(0)))


def frontend_type_keys() -> set:
    """The field names of the Acts interface the app compiles against."""
    s = TYPES.read_text(encoding="utf-8")
    m = re.search(r"export interface Acts \{(.*?)\}", s, re.S)
    assert m, "Acts interface not found"
    return set(re.findall(r"^\s*([A-Za-z_]\w*):", m.group(1), re.M))


def frontend_page_keys() -> set:
    """Every acts.<key> the case page reads (the buttons it can render)."""
    s = CASE_PAGE.read_text(encoding="utf-8")
    return set(re.findall(r"acts\.([A-Za-z_]\w*)", s))


def test_every_write_has_a_mapped_gate():
    s = CONTRACT.read_text(encoding="ascii")
    writes = re.findall(r"    @gl\.public\.write(?:\.payable)?\n    def (\w+)\(", s)
    assert writes, "no writes found"
    for w in writes:
        assert w in WRITE_TO_GATE, f"write {w} has no mapped gate"


def test_contract_and_app_gate_keys_are_identical():
    contract = contract_gate_keys()
    app = frontend_type_keys()
    assert contract == app, (
        f"gate keys drifted.\n  contract only: {sorted(contract - app)}\n"
        f"  app only: {sorted(app - contract)}"
    )


def test_case_page_reads_only_real_gates():
    app = frontend_type_keys()
    page = frontend_page_keys()
    missing = page - app
    assert not missing, f"case page reads gates the contract does not emit: {sorted(missing)}"


def test_case_page_renders_every_critical_gate():
    page = frontend_page_keys()
    for gate in CRITICAL_GATES:
        assert gate in page, f"case page never reads acts.{gate} (its button cannot render)"


def test_get_actions_emits_every_mapped_gate():
    gates = contract_gate_keys()
    for w, gate in WRITE_TO_GATE.items():
        assert gate is None or gate in gates, f"{w} is not gated by get_actions ({gate})"


def test_gate_reasons_are_user_facing():
    s = CONTRACT.read_text(encoding="ascii")
    nos = re.findall(r"no\((.*?)\)", s)
    assert len(nos) >= 20, f"only {len(nos)} refusal reasons"
    for n in nos:
        text = n.strip()
        if text in ("why: str", "expired_msg") or text.startswith("f\"") or text.startswith("f'"):
            continue
        assert len(text.strip('"')) >= 10, f"cryptic reason: {n}"
        assert "Traceback" not in text


# ---- canonical JSON: the bytes the browser must reproduce ------------------
#
# Every digest is a SHA-256 over the contract's `_canon`. The Verify page
# recomputes those digests in the browser (web/lib/verify.ts). If the two
# implementations disagree on one byte, the page reports MISMATCH for a case
# that is perfectly valid — so the divergence has to fail a test, not a user.
# `canonical.json` is the shared fixture; the browser test reads the same file.

def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)


def test_contract_canon_is_the_replicated_form():
    """The form tests/parity/canonical.py reproduces is the one in the contract."""
    s = CONTRACT.read_text(encoding="ascii")
    assert CONTRACT_CALL in s, (
        "the contract's _canon no longer matches the replicated form; change "
        "tests/parity/canonical.py and web/lib/verify.ts together"
    )


def test_parity_fixture_is_current():
    """The committed fixture is exactly what the shared generator produces."""
    assert FIXTURE.exists(), f"missing {FIXTURE}; run: python tests/parity/canonical.py"
    committed = json.loads(FIXTURE.read_text(encoding="ascii"))
    assert committed == build_fixture(), (
        "tests/parity/fixtures/canonical.json is stale; run: python tests/parity/canonical.py"
    )


def test_parity_fixture_covers_non_ascii_and_astral():
    """The fixture must exercise what the browser used to get wrong."""
    strings = [x for _, value in CASES for x in _strings(value)]
    assert any(ord(ch) > 0x7F for s in strings for ch in s), "fixture has no non-ASCII text"
    assert any(ord(ch) > 0xFFFF for s in strings for ch in s), "fixture has no astral text"


def test_parity_fixture_binds_browser_and_contract():
    """web/lib/verify.test.ts reads this fixture, so the two sides cannot drift."""
    ts = VERIFY_TS.read_text(encoding="utf-8")
    assert "fixtures/canonical.json" in ts, "the browser test no longer reads the shared fixture"


def test_every_fixture_digest_recomputes():
    for case in build_fixture()["cases"]:
        assert case["canonical"] == canon(case["value"]), case["name"]
        assert case["sha256"] == digest(case["value"]), case["name"]


# ---- the client exposes the documented write surface -----------------------
#
# The steward's finding: docs/ARCHITECTURE.md documents fund_case, revise_terms,
# submit_text, expire_case and lapse_case, and the console did not expose them
# (a "Revise terms" button rendered with no handler at all). These tests pin the
# app to the documented surface so a path cannot silently disappear again.

REQUIRED_CLIENT_WRITES = (
    "open_case", "revise_terms", "accept_case", "decline_case", "withdraw_case",
    "accept_inspector", "fund_case", "expire_case", "submit_image", "submit_text",
    "mark_ready", "lapse_case", "request_assessment", "challenge", "readjudicate",
    "close_challenge", "finalize", "withdraw",
)


def test_every_write_is_reachable_from_the_client():
    """Every write the contract documents is called from the app, not just declared."""
    web = ROOT / "web"
    sources = []
    for sub in ("app", "lib", "components"):
        sources += [
            p.read_text(encoding="utf-8")
            for p in (web / sub).rglob("*")
            if p.suffix in (".ts", ".tsx") and not p.name.endswith(".test.ts") and not p.name.endswith(".test.tsx")
        ]
    text = "\n".join(sources)
    missing = [w for w in REQUIRED_CLIENT_WRITES if f'"{w}"' not in text]
    assert not missing, f"writes the contract exposes but the client never calls: {missing}"


def test_no_action_button_is_a_dead_end():
    """A rendered `Can` affordance must carry a handler (revise once had none)."""
    s = CASE_PAGE.read_text(encoding="utf-8")
    for line in s.splitlines():
        if "<Can " in line and "can={acts." in line:
            assert "onClick=" in line, f"dead action button: {line.strip()}"
