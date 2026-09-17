#!/usr/bin/env python3
"""Fail if Kotlin references an `R.string`/`R.array`/`R.plurals` name that
`values/strings.xml` does not define, or if a resource name is defined twice.

A missing name is a compile error, but the Android build takes minutes to reach
it; this catches the whole set in under a second during an extraction pass.

    python scripts/check_string_refs.py
"""
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app/src"
STRINGS = ROOT / "app/src/main/res/values/strings.xml"

REF = re.compile(r"R\.(string|array|plurals)\.(\w+)")


def main() -> int:
    xml = STRINGS.read_text(encoding="utf-8")
    defined = Counter(re.findall(r'<(?:string|string-array|plurals) name="([^"]+)"', xml))
    duplicates = sorted(n for n, c in defined.items() if c > 1)

    missing: dict[str, set[str]] = {}
    for path in SRC.rglob("*.kt"):
        for _, name in REF.findall(path.read_text(encoding="utf-8")):
            if name not in defined:
                missing.setdefault(name, set()).add(path.relative_to(SRC).as_posix())

    for name in duplicates:
        print(f"DUPLICATE  {name} defined {defined[name]} times")
    for name, files in sorted(missing.items()):
        print(f"MISSING    {name}  ({', '.join(sorted(files))})")
    if not missing and not duplicates:
        print(f"ok — {len(defined)} resources, every R.* reference resolves")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
