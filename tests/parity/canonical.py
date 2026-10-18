"""Shared canonical-JSON parity cases.

Every digest Parlv records is a SHA-256 over canonical JSON built by the
contract's ``_canon``::

    json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

The browser rebuilds the same bytes in ``web/lib/verify.ts`` so the Verify page
can recompute a digest without trusting the app. If the two implementations
differ on a single byte the page shows MISMATCH for a case that is perfectly
valid.

``ensure_ascii=True`` is the subtle half: non-ASCII text (an accented name in a
claim, a CJK note, an emoji) is escaped to ``\\uXXXX`` by the contract, while
``JSON.stringify`` leaves it as raw UTF-8. Code-point key ordering is the other
subtle half: Python sorts strings by code point, JavaScript by UTF-16 code
unit, and the two disagree once a key holds an astral character beside a BMP
character at or above U+E000.

These cases pin both sides to one another. ``canonical.json`` is the committed
fixture; the Python test regenerates it, and the browser test reads it and must
reproduce every ``canonical`` string and ``sha256``. Regenerate with::

    python tests/parity/canonical.py
"""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests" / "parity" / "fixtures" / "canonical.json"

# The exact expression the contract uses. test_parity.py asserts this literal
# is still present in the contract source, so the replication below cannot
# silently drift from the thing it claims to mirror.
CONTRACT_CALL = 'json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)'

# (name, value) pairs. Literal non-ASCII where it reads better, escapes where
# the point is an invisible character.
CASES = [
    ("ascii_baseline", {"b": 1, "a": [2, {"d": 4, "c": 3}]}),
    ("latin_accents", {"claim": "Le mur a été repeint, café Ñ"}),
    ("accented_key", {"clé": "valeur"}),
    ("cyrillic", {"note": "Доставка выполнена"}),
    ("greek", {"note": "Παράδοση"}),
    ("cjk", {"title": "瓦礫の撤去", "note": "配送完了"}),
    ("arabic", {"note": "تم التسليم"}),
    ("hebrew", {"note": "נמסר"}),
    ("combining_mark", {"note": "e\u0301"}),
    ("bmp_symbol", {"mark": "✔ accepted"}),
    ("astral_emoji", {"face": "😀"}),
    ("zwj_sequence", {"who": "👩‍💻"}),
    ("astral_key_vs_bmp_key", {"\ue000": "bmp-private", "😀": "astral"}),
    ("controls", {"note": "a\tb\nc\u0001d\u001fe\r"}),
    ("quotes_and_backslash", {"note": 'he said "hi" \\ bye'}),
    ("del_and_fullwidth", {"note": "\u007f IV ＡＢＣ Ⅳ"}),
    ("line_and_para_separators", {"note": "a\u2028b\u2029c"}),
    ("lone_surrogate", {"bad": "\ud800"}),
    ("nested", {"a": "z", "b": [{"é": "ü"}, 2, True, None]}),
    ("numbers_and_bools", {"n": 0, "m": 42, "big": 10**18, "t": True, "f": False, "z": None}),
    ("empty_and_spaces", {"a": "", "b": " ", "c": "  padded  "}),
]


def canon(value) -> str:
    """The contract's canonical form, reproduced exactly."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value) -> str:
    """The contract's digest: SHA-256 of the canonical form, encoded as ASCII."""
    return hashlib.sha256(canon(value).encode("ascii")).hexdigest()


def build_fixture() -> dict:
    return {
        "note": (
            "Produced by tests/parity/canonical.py. The browser's canonDeep must "
            "reproduce every canonical string and sha256 here."
        ),
        "canon_expr": CONTRACT_CALL,
        "cases": [
            {"name": name, "value": value, "canonical": canon(value), "sha256": digest(value)}
            for name, value in CASES
        ],
    }


def write_fixture() -> Path:
    text = json.dumps(build_fixture(), indent=2, ensure_ascii=True) + "\n"
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    # newline="\n" keeps the fixture byte-identical across platforms; the default
    # would write CRLF on Windows and make a regeneration look like a change.
    with FIXTURE.open("w", encoding="ascii", newline="\n") as fh:
        fh.write(text)
    return FIXTURE


if __name__ == "__main__":
    print(write_fixture())
