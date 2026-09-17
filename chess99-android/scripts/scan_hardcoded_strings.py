#!/usr/bin/env python3
"""Count user-facing string literals still hardcoded in the Compose sources.

A "site" is a double-quoted literal passed to one of the parameters/functions that
puts text on screen (Text, contentDescription, label, placeholder, title, ...).
Literals that are pure identifiers, URLs, route names, log tags or format keys are
skipped by heuristic.  Run:

    python scripts/scan_hardcoded_strings.py            # per-file totals
    python scripts/scan_hardcoded_strings.py <file.kt>  # the sites in one file
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "app/src/main/java/com/chess99"

# A literal is a candidate when it is preceded by one of these on the same line.
TRIGGERS = re.compile(
    r"(?:\bText\s*\(|\bcontentDescription\s*=|\blabel\s*=|\bplaceholder\s*=|"
    r"\btitle\s*=|\bsupportingText\s*=|\btext\s*=|\bmessage\s*=|"
    r"\bconfirmButton|\bdismissButton|\bTextButton|\breturn\s+|\b->\s*)"
)

STRING = re.compile(r'"(?:\\.|[^"\\])*"')

SKIP_LINE = re.compile(r"^\s*(?://|\*|/\*)")
SKIP_LITERAL = re.compile(
    r"^\"(?:"
    r"|[a-z0-9_]+"              # identifiers / json keys / routes
    r"|[A-Z_]+"                 # constants
    r"|https?://.*"
    r"|[^A-Za-z]*"              # punctuation / numbers only
    r"|%[sd].*"
    r")\"$"
)


def sites(text: str):
    for i, line in enumerate(text.splitlines(), 1):
        if SKIP_LINE.match(line):
            continue
        for m in STRING.finditer(line):
            before = line[: m.start()]
            if not TRIGGERS.search(before):
                continue
            lit = m.group(0)
            if SKIP_LITERAL.match(lit):
                continue
            if len(lit) <= 3:
                continue
            yield i, lit, line.strip()


def main() -> int:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        for ln, lit, line in sites(p.read_text(encoding="utf-8")):
            print(f"{ln}: {line}")
        return 0
    totals = []
    for p in sorted(SRC.rglob("*.kt")):
        n = sum(1 for _ in sites(p.read_text(encoding="utf-8")))
        if n:
            totals.append((n, p.relative_to(SRC).as_posix()))
    totals.sort(reverse=True)
    for n, rel in totals:
        print(f"{n:4d}  {rel}")
    print(f"----\n{sum(n for n, _ in totals)} sites in {len(totals)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
