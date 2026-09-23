"""Browser walkthrough: focus, tab wordwise, history, neon checklist, celebrate share."""

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/?NODEMO"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 860})
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_selector("#cmdline")
        page.wait_for_selector("#goal-panel")

        def run(cmd: str) -> None:
            page.fill("#cmdline", cmd)
            page.press("#cmdline", "Enter")
            page.wait_for_timeout(120)

        run("whoami")
        focused = page.evaluate("() => document.activeElement && document.activeElement.id")
        assert focused == "cmdline", f"focus lost: {focused}"

        page.press("#cmdline", "ArrowUp")
        val = page.input_value("#cmdline")
        assert val == "whoami", f"history got {val!r}"
        page.press("#cmdline", "Escape")

        page.fill("#cmdline", "gre")
        page.press("#cmdline", "Tab")
        val = page.input_value("#cmdline")
        assert val.startswith("gre"), f"tab word got {val!r}"
        assert val.strip() in ("grep", "grep ", "grep") or val == "grep", f"tab filled too much: {val!r}"

        page.fill("#cmdline", "ls -")
        page.press("#cmdline", "Tab")
        val = page.input_value("#cmdline")
        assert val.startswith("ls"), f"lost head: {val!r}"
        assert val.count(" ") <= 2, f"too many words: {val!r}"
        assert "grep ERROR" not in val, f"whole command tab: {val!r}"

        page.evaluate("window.learnLinux.ui.startLevel('intro-pwd')")
        page.wait_for_timeout(150)
        while page.locator("#modal-root [data-next]").count() > 0:
            page.click("#modal-root [data-next]")
            page.wait_for_timeout(80)
        if page.locator("#modal-root [data-close]").count() > 0:
            page.click("#modal-root [data-close]")
            page.wait_for_timeout(80)

        goal = page.inner_text("#goal-panel")
        assert ("goal" in goal.lower() or "GOAL" in goal) and "pwd" in goal.lower(), goal[:200]
        assert page.locator(".sol-steps li.is-current").count() == 1, "neon current step missing"

        run("pwd")
        page.wait_for_timeout(300)

        assert page.locator(".celebrate").count() == 1, "celebrate missing"
        for kind in ("linkedin", "x", "facebook", "copy"):
            assert page.locator(f'[data-share="{kind}"]').count() == 1, f"missing share {kind}"

        page.click('[data-share="copy"]')
        page.wait_for_timeout(200)
        status = page.inner_text("[data-share-status]")
        assert "copied" in status.lower() or "Post" in status, status

        page.click('[data-act="0"]')
        page.wait_for_timeout(100)
        focused = page.evaluate("() => document.activeElement && document.activeElement.id")
        assert focused == "cmdline", f"focus after stay: {focused}"

        page.fill("#cmdline", "")
        page.dispatch_event("#cmdline", "input")
        ghost = page.get_attribute("#term-ghost", "data-visible")
        assert ghost != "1", "ghost visible on empty input"

        page.screenshot(path="output-celebrate-share.png", full_page=True)
        if errors:
            raise SystemExit("PAGE ERRORS:\n" + "\n".join(errors))
        print("UI ENHANCEMENTS OK")


if __name__ == "__main__":
    main()
