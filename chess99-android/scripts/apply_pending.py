#!/usr/bin/env python3
"""Apply only the batch entries that have not been applied yet.

`extract_strings.py` deliberately fails when a pattern is missing, which makes
re-running a half-applied multi-file batch impossible. This wrapper skips any
entry whose edits are all already applied, so a batch that failed halfway can
be resumed without hand-editing it.

    python scripts/apply_pending.py scripts/string-batches/group7.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_strings import SRC, apply_batch  # noqa: E402


def pending(batch: dict) -> bool:
    text = (SRC / batch["file"]).read_text(encoding="utf-8")
    return any(old in text for old, _ in batch["edits"])


def main() -> int:
    for arg in sys.argv[1:]:
        data = json.loads(Path(arg).read_text(encoding="utf-8"))
        for batch in data if isinstance(data, list) else [data]:
            if pending(batch):
                apply_batch(batch)
            else:
                print(f"{batch['file']}: already applied, skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
