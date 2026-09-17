#!/usr/bin/env python3
"""Apply a batch of UI-copy extractions to Kotlin sources and strings.xml.

Input is a JSON batch file:

    {
      "section": "Lobby",                     # comment header in strings.xml
      "file": "presentation/lobby/LobbyScreen.kt",
      "strings": {"lobby_title": "Play Online"},
      "edits": [["Text(\"Play Online\")",
                 "Text(stringResource(R.string.lobby_title))"]]
    }

or a list of those objects.  Every `old` must occur in the file at least once
(the script fails loudly otherwise, so a stale batch can never silently no-op),
and every replacement is applied to all occurrences.  Imports for
`androidx.compose.ui.res.stringResource` and `com.chess99.R` are added when the
new text needs them and they are not already present.

    python scripts/extract_strings.py batches/lobby.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app/src/main/java/com/chess99"
STRINGS = ROOT / "app/src/main/res/values/strings.xml"

STRING_RES_IMPORT = "import androidx.compose.ui.res.stringResource"
R_IMPORT = "import com.chess99.R"


def kotlin_to_xml(value: str) -> str:
    """Escape a plain Kotlin string value for an Android string resource."""
    out = escape(value)  # & < >
    out = out.replace("'", "\\'").replace('"', '\\"')
    out = out.replace("\n", "\\n")
    if out.startswith(" ") or out.endswith(" "):
        out = f'"{out}"'
    return out


def add_strings(section: str, pairs: dict[str, str]) -> list[str]:
    text = STRINGS.read_text(encoding="utf-8")
    existing = set(re.findall(r'<string name="([^"]+)"', text))
    added = []
    lines = []
    for name, value in pairs.items():
        if name in existing:
            current = re.search(
                rf'<string name="{re.escape(name)}">(.*?)</string>', text, re.S
            )
            want = kotlin_to_xml(value)
            if current and current.group(1) != want:
                raise SystemExit(
                    f"{name} already exists with a different value:\n"
                    f"  have {current.group(1)!r}\n  want {want!r}"
                )
            continue
        lines.append(f'    <string name="{name}">{kotlin_to_xml(value)}</string>')
        added.append(name)
    if not lines:
        return added
    block = f"\n    <!-- ── {section} ── -->\n" + "\n".join(lines) + "\n"
    text = text.replace("</resources>", block + "</resources>")
    STRINGS.write_text(text, encoding="utf-8")
    return added


def ensure_imports(text: str, needs_string_res: bool, needs_r: bool) -> str:
    wanted = []
    if needs_string_res and STRING_RES_IMPORT not in text:
        wanted.append(STRING_RES_IMPORT)
    if needs_r and not re.search(rf"^{re.escape(R_IMPORT)}$", text, re.M):
        wanted.append(R_IMPORT)
    if not wanted:
        return text
    lines = text.split("\n")
    idx = [i for i, ln in enumerate(lines) if ln.startswith("import ")]
    if not idx:
        raise SystemExit("no import block found")
    imports = sorted(set(lines[idx[0] : idx[-1] + 1]) | set(wanted))
    return "\n".join(lines[: idx[0]] + imports + lines[idx[-1] + 1 :])


def apply_batch(batch: dict) -> None:
    path = SRC / batch["file"]
    text = path.read_text(encoding="utf-8")
    added = add_strings(batch.get("section", "Misc"), batch.get("strings", {}))

    missing = [old for old, _ in batch["edits"] if old not in text]
    if missing:
        raise SystemExit(
            f"{batch['file']}: {len(missing)} pattern(s) not found:\n  "
            + "\n  ".join(repr(m) for m in missing)
        )
    count = 0
    for old, new in batch["edits"]:
        count += text.count(old)
        text = text.replace(old, new)

    text = ensure_imports(
        text,
        needs_string_res="stringResource(" in text,
        needs_r="R.string." in text or "R.plurals." in text,
    )
    path.write_text(text, encoding="utf-8")
    print(f"{batch['file']}: {count} site(s), {len(added)} new string(s)")


def main() -> int:
    for arg in sys.argv[1:]:
        data = json.loads(Path(arg).read_text(encoding="utf-8"))
        for batch in data if isinstance(data, list) else [data]:
            apply_batch(batch)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
