from pathlib import Path

OLD_A = "session.quizOk === true || session.history.some((h) => /true/.test(h))"
OLD_B = (
    "session.quizOk === true || session.history.some((h) => "
    "/(^|;|\\s)true(\\s|;|$)/.test(h) && session.quizOk !== false)"
)
NEW = "session.quizOk === true"

for name in ["levels-polish.js", "levels-gap.js"]:
    p = Path("js") / name
    t = p.read_text(encoding="utf-8")
    t2 = t.replace(OLD_A, NEW).replace(OLD_B, NEW)
    p.write_text(t2, encoding="utf-8")
    print(name, "ok", t2.count(NEW), "leftover_bypass", "|| session.history.some((h) => /true" in t2)
