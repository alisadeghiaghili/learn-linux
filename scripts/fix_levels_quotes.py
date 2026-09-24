"""Fix single-quoted strings incorrectly closed with double quotes in level packs."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent / "js"
for name in ("levels-text.js", "levels-advanced.js", "levels-core.js", "levels.js"):
    p = root / name
    t = p.read_text(encoding="utf-8")
    # line is a single-quoted JS string that ends with .",
    t2 = re.sub(r"^(\s*)'([^']*)\.\"(,\s*)$", lambda m: f"{m.group(1)}'{m.group(2)}.'{m.group(3)}", t, flags=re.M)
    t2 = re.sub(r"^(\s*)'([^']*)\",(\s*)$", lambda m: f"{m.group(1)}'{m.group(2)}',{m.group(3)}", t2, flags=re.M)
    if t2 != t:
        p.write_text(t2, encoding="utf-8")
        print("fixed", p.name)
    else:
        print("ok", p.name)
