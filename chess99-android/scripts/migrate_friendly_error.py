#!/usr/bin/env python3
"""One-shot migration: `friendlyError(e, "your stats")` -> resource form.

`friendlyError` used to take the failing subject as a literal, which kept a
sentence of user copy in every ViewModel. This rewrites each call to
`friendlyError(context, e, R.string.error_subject_x)`, mints the
`error_subject_*` resources, and injects `@ApplicationContext private val
context: Context` into any Hilt ViewModel that now needs one.

Idempotent: re-running finds no literal-form calls and does nothing. Kept in
the tree as the record of how the subjects were named.

    python scripts/migrate_friendly_error.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app/src/main/java/com/chess99"
STRINGS = ROOT / "app/src/main/res/values/strings.xml"

CALL = re.compile(r'friendlyError\((?P<e>[^",]+), "(?P<what>[^"]+)"\)')
CTOR = re.compile(r"(@Inject constructor\((?P<params>[^)]*?)\n)\) : ViewModel\(\) \{")


def slug(what: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", what.lower()).strip("_")
    return f"error_subject_{s}"


def add_strings(pairs: dict[str, str]) -> int:
    text = STRINGS.read_text(encoding="utf-8")
    existing = set(re.findall(r'<string name="([^"]+)"', text))
    lines = [
        f'    <string name="{n}">{v}</string>'
        for n, v in sorted(pairs.items())
        if n not in existing
    ]
    if not lines:
        return 0
    block = (
        "\n    <!-- ── Failure copy subjects (see ErrorCopy.kt) ── -->\n"
        + "\n".join(lines)
        + "\n"
    )
    STRINGS.write_text(text.replace("</resources>", block + "</resources>"), encoding="utf-8")
    return len(lines)


def context_name(text: str) -> str | None:
    """Name of the file's existing @ApplicationContext property, if any."""
    m = re.search(r"@ApplicationContext (?:private )?val (\w+): Context", text)
    return m.group(1) if m else None


def inject_context(text: str) -> str:
    """Give the file's Hilt ViewModel an @ApplicationContext, if it lacks one."""
    if "@ApplicationContext" in text:
        return text
    m = CTOR.search(text)
    if not m:
        raise SystemExit("no `@Inject constructor(...) : ViewModel()` to inject into")
    param = (
        "    // Injected so failure copy can be read from strings.xml.\n"
        "    @ApplicationContext private val context: Context,\n"
    )
    text = text[: m.end(1)] + param + text[m.end(1) :]
    imports = [
        "import android.content.Context",
        "import com.chess99.R",
        "import dagger.hilt.android.qualifiers.ApplicationContext",
    ]
    lines = text.split("\n")
    idx = [i for i, ln in enumerate(lines) if ln.startswith("import ")]
    wanted = [i for i in imports if not re.search(rf"^{re.escape(i)}$", text, re.M)]
    block = sorted(set(lines[idx[0] : idx[-1] + 1]) | set(wanted))
    return "\n".join(lines[: idx[0]] + block + lines[idx[-1] + 1 :])


def main() -> int:
    subjects: dict[str, str] = {}
    touched = 0
    for path in sorted(SRC.rglob("*.kt")):
        text = path.read_text(encoding="utf-8")
        if not CALL.search(text):
            continue
        for m in CALL.finditer(text):
            subjects[slug(m.group("what"))] = m.group("what").replace("'", "\\'")
        n = len(CALL.findall(text))
        ctx = context_name(text) or "context"
        text = CALL.sub(
            lambda m: f'friendlyError({ctx}, {m.group("e").strip()}, R.string.{slug(m.group("what"))})',
            text,
        )
        text = inject_context(text)
        path.write_text(text, encoding="utf-8")
        print(f"{path.relative_to(SRC).as_posix()}: {n} call(s)")
        touched += n
    added = add_strings(subjects)
    print(f"\n{touched} call site(s), {added} new subject string(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
