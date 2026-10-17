"""App-contract parity: the frontend's action gates must mirror get_actions.

The web app renders `get_actions` directly (it never reimplements the rules),
so the wire keys the contract emits and the keys the app reads must be the
same. This test extracts BOTH sets from source and asserts they agree, so a
rename on either side fails here instead of silently hiding a button. A hidden
button is a security-relevant defect: a user who cannot see "Withdraw case" or
"Close challenge" cannot exercise the right the contract grants them.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "parlv.py"
TYPES = ROOT / "web" / "lib" / "types.ts"
CASE_PAGE = ROOT / "web" / "app" / "cases" / "[id]" / "page.tsx"

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
