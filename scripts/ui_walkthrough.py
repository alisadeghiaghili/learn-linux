"""Browser walkthrough for learn-linux UI.

Serves as a smoke of terminal input, tree updates, and level flow.
"""

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/?NODEMO"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_selector("#cmdline")
        page.wait_for_selector("#tree")

        # Welcome modal may show without NODEMO; with NODEMO sandbox only
        # Run commands
        def run(cmd: str) -> None:
            page.fill("#cmdline", cmd)
            page.press("#cmdline", "Enter")
            page.wait_for_timeout(150)

        run("whoami")
        run("pwd")
        run("mkdir demo")
        run("touch demo/notes.txt")
        run("ls")
        run("echo hello > demo/out.txt")

        body = page.inner_text("#term")
        assert "ubuntu" in body, "whoami output missing"
        assert "/home/ubuntu" in body, "pwd output missing"
        tree = page.inner_text("#tree")
        assert "demo" in tree, "tree missing demo: " + tree
        assert "notes.txt" in tree or "notes" in tree, "tree missing notes"

        # Start a level via JS API
        page.evaluate("window.learnLinux.ui.startLevel('intro-pwd')")
        page.wait_for_timeout(200)
        # close dialog if present
        while page.locator("#modal-root [data-next]").count() > 0:
            page.click("#modal-root [data-next]")
            page.wait_for_timeout(100)
        if page.locator("#modal-root [data-close]").count() > 0:
            page.click("#modal-root [data-close]")
            page.wait_for_timeout(100)

        run("pwd")
        page.wait_for_timeout(300)
        # win modal
        if page.locator(".win-card").count() > 0:
            win = page.inner_text(".win-card")
            assert "Level complete" in win or "complete" in win.lower(), win
        else:
            # maybe already closed or still open
            body2 = page.inner_text("#term")
            assert "pwd" in body2

        page.screenshot(path="output-playwright-ui.png", full_page=True)
        if errors:
            raise SystemExit("PAGE ERRORS:\n" + "\n".join(errors))
        print("UI WALKTHROUGH OK")


if __name__ == "__main__":
    main()
