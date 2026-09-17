#!/usr/bin/env python3
"""Count the Kotlin sites that still hold user-facing copy, file by file.

Same heuristic as `scan_all_literals.py` (capitalised literal containing a
lower-case letter, outside comments and logging calls), but repo-wide and
counted rather than printed, so the extraction pass has a single number to
watch.  Expect false positives — it is a progress meter, not a gate.

    python scripts/count_remaining_literals.py
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "app/src/main/java/com/chess99"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

STRING = re.compile(r'"(?:\\.|[^"\\])*"')
COPY = re.compile('^"[A-Z←-➿].*[a-z]')
SKIP_LINE = re.compile(r"^\s*(?://|\*|/\*)")


def main() -> int:
    counts: dict[str, int] = {}
    for path in sorted(SRC.rglob("*.kt")):
        n = 0
        for line in path.read_text(encoding="utf-8").splitlines():
            if SKIP_LINE.match(line) or "Timber." in line or "Log." in line:
                continue
            for m in STRING.finditer(line):
                if COPY.match(m.group(0)) and "stringResource" not in m.group(0):
                    n += 1
                    break
        if n:
            counts[path.relative_to(SRC).as_posix()] = n
    for name, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"{n:4d}  {name}")
    print(f"\nTOTAL {sum(counts.values())} line(s) in {len(counts)} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
