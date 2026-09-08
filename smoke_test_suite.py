from playwright.sync_api import sync_playwright
import sys
import os

def run_smoke_test_suite():
    console_errors = []

    # Ensure verification directories exist
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

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

            print("2. Verifying Main Menu & Routine Cards...")
            assert page.locator("#main-menu-modal").is_visible()
            assert page.locator("#card-gridshot").is_visible()
            assert page.locator("#card-micro").is_visible()
            assert page.locator("#card-reaction").is_visible()

            print("3. Testing Mouse Sensitivity Slider & Settings...")
            sens_slider = page.locator("#setting-sens")
            assert sens_slider.is_visible()
            sens_slider.fill("2.5")
            page.wait_for_timeout(200)
            sens_val = page.locator("#sens-val-display").text_content()
            assert sens_val == "2.50"

            print("4. Testing Pointer Lock Checkbox & Toggle Button...")
            pl_checkbox = page.locator("#setting-pointer-lock-checkbox")
            pl_checkbox.check()
            page.wait_for_timeout(200)

            pl_btn = page.locator("#pointer-lock-toggle-btn")
            assert "ON" in pl_btn.text_content()

            print("5. Selecting Routine and Launching Gridshot Drill...")
            page.locator("#card-gridshot").click()
            page.locator("#close-menu-start-btn").click()

            page.wait_for_timeout(3000) # Wait for 3s countdown

            print("6. Simulating Target Clicks on Canvas...")
            canvas = page.locator("#game-canvas")
            assert canvas.is_visible()

            # Click center of canvas multiple times
            box = canvas.bounding_box()
            if box:
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2
                page.mouse.click(cx, cy)
                page.wait_for_timeout(200)
                page.mouse.click(cx - 50, cy - 50)
                page.wait_for_timeout(200)
                page.mouse.click(cx + 50, cy + 50)
                page.wait_for_timeout(200)

            hits_text = page.locator("#hud-hits").text_content()
            misses_text = page.locator("#hud-misses").text_content()
            print(f"HUD Telemetry: Hits = {hits_text}, Misses = {misses_text}")

            print("7. Testing Mode Switch to Reaction Time...")
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
            assert page.locator("#main-menu-modal").is_visible()

            page.locator("#card-reaction").click(force=True)
            page.locator("#close-menu-start-btn").click(force=True)
            page.wait_for_timeout(1000)

            print("8. Testing Reset Drill...")
            page.locator("#reset-drill-btn").click(force=True)
            page.wait_for_timeout(500)

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
