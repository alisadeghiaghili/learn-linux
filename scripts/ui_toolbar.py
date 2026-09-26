"""Screenshot toolbar to verify button chrome matches the reference."""

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/?NODEMO"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_selector(".toolbar-actions")
        labels = page.locator(".toolbar-actions button, .toolbar-actions a").all_text_contents()
        print("TOOLBAR", labels)
        # required set from reference
        text = page.inner_text(".toolbar-actions")
        for need in ("EN", "Levels", "Lesson", "Guide", "Hint", "Solution", "Undo", "Reset", "Sandbox", "Buy me a coffee"):
            assert need in text, f"missing {need} in {text}"
        # ? and github icon
        assert page.locator(".help-btn").count() == 1
        assert page.locator(".tb-link.gh").count() == 1
        assert page.locator(".tb-link.support").count() == 1
        page.locator(".toolbar-actions").screenshot(path="output-toolbar.png")
        if errors:
            raise SystemExit("\n".join(errors))
        print("TOOLBAR OK")


if __name__ == "__main__":
    main()
