from playwright.sync_api import sync_playwright
import sys

def run_smoke_test_suite():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        page.on("pageerror", lambda err: console_errors.append(str(err)))

        try:
            print("1. Loading index.html...")
            page.goto("http://localhost:8080/index.html")
            page.wait_for_timeout(1000)

            print("2. Verifying Main Menu...")
            assert page.locator("#main-menu-modal").is_visible()

            print("3. Starting game (Deploy on duty)...")
            page.locator("#start-game-btn").click()
            page.wait_for_timeout(1000)

            print("4. Testing Movement keys (W, S, A, D)...")
            page.keyboard.press("KeyW")
            page.wait_for_timeout(200)
            page.keyboard.press("KeyS")
            page.wait_for_timeout(200)
            page.keyboard.press("KeyA")
            page.wait_for_timeout(200)
            page.keyboard.press("KeyD")
            page.wait_for_timeout(200)

            print("5. Testing Crouch (C), Sprint (Shift), Jump (Space)...")
            page.keyboard.press("KeyC")
            page.wait_for_timeout(200)
            page.keyboard.press("KeyC")
            page.wait_for_timeout(200)

            print("6. Testing Equipment (G, J, X)...")
            page.keyboard.press("KeyG")
            page.wait_for_timeout(300)
            page.keyboard.press("KeyJ")
            page.wait_for_timeout(300)
            page.keyboard.press("KeyX")
            page.wait_for_timeout(300)

            print("7. Testing Tactical Map (M)...")
            page.keyboard.press("KeyM")
            page.wait_for_timeout(500)
            close_map_btn = page.locator("#close-map-btn")
            if close_map_btn.is_visible():
                close_map_btn.click()
            page.wait_for_timeout(500)

            print("8. Testing Pause / Resume...")
            page.evaluate("togglePauseMenu()")
            page.wait_for_timeout(500)
            assert page.locator("#pause-modal").is_visible()
            page.locator("#resume-game-btn").click()
            page.wait_for_timeout(500)

            print("9. Testing Map Transitions...")
            map_select = page.locator("#map-select")
            map_select.select_option("bank")
            page.wait_for_timeout(500)
            map_select.select_option("warehouse")
            page.wait_for_timeout(500)
            map_select.select_option("street")
            page.wait_for_timeout(500)

            print("10. Testing Game Over & Restart...")
            page.evaluate("damagePlayer(200)")
            page.wait_for_timeout(500)
            assert page.locator("#game-over-modal").is_visible()
            page.locator("#restart-mission-btn").click()
            page.wait_for_timeout(1000)

            print("Taking smoke test completion screenshot...")
            page.screenshot(path="/home/jules/verification/screenshots/smoke_test_suite_pass.png")

            print("\n=== CONSOLE ERRORS ===")
            if console_errors:
                print(f"FAILED: {len(console_errors)} console errors found:")
                for err in console_errors:
                    print(f" - {err}")
                sys.exit(1)
            else:
                print("Zero console errors! Smoke test suite passed. 🎉")

        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run_smoke_test_suite()
