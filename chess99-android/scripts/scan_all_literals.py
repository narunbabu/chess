#!/usr/bin/env python3
"""List every string literal in a Kotlin file that reads like user-facing copy.

Looser than `scan_hardcoded_strings.py` (which only looks at literals passed to a
known text parameter): this one reports any literal that starts with a capital
letter and contains a lower-case letter, whatever it is passed to.  It is a
review aid for the file-by-file extraction pass — expect false positives (log
messages, JSON keys with capitals, engine notation) and judge each one.

    python scripts/scan_all_literals.py presentation/lobby/LobbyScreen.kt
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "app/src/main/java/com/chess99"

if hasattr(sys.stdout, "reconfigure"):  # copy is not ASCII (·, →, — …)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

STRING = re.compile(r'"(?:\\.|[^"\\])*"')
COPY = re.compile(r'^"[A-Z←-➿].*[a-z]')
SKIP_LINE = re.compile(r"^\s*(?://|\*|/\*)")


def main() -> int:
    for arg in sys.argv[1:]:
        p = Path(arg)
        if not p.exists():
            p = SRC / arg
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if SKIP_LINE.match(line):
                continue
            if "Timber." in line or "Log." in line:
                continue
            for m in STRING.finditer(line):
                if COPY.match(m.group(0)) and "stringResource" not in m.group(0):
                    print(f"{i}: {line.strip()}")
                    break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
