import asyncio
from playwright.async_api import async_playwright
import os
import subprocess
import time

async def main():
    # Start web server
    server = subprocess.Popen(["python3", "-m", "http.server", "8085"])
    time.sleep(1.5)

    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        await page.goto("http://localhost:8085/index.html")
        await page.wait_for_timeout(1000)

        # 1. Capture main street view showing expanded map and solid barricades
        await page.screenshot(path="/home/jules/verification/screenshots/barricades_expanded_map.png")

        # 2. Open Buy Menu to show Optional Attachments
        await page.click("#open-buy-menu-btn")
        await page.wait_for_timeout(500)
        await page.screenshot(path="/home/jules/verification/screenshots/buy_menu_attachments.png")

        # 3. Buy Red Dot Sight & Laser Sight
        await page.click("#buy-att-reddot")
        await page.click("#buy-att-laser")
        await page.wait_for_timeout(500)
        await page.screenshot(path="/home/jules/verification/screenshots/buy_menu_mounted.png")

        # Close buy menu & start round
        await page.click("#close-buy-menu-btn")
        await page.wait_for_timeout(500)
        await page.click("#start-round-btn")
        await page.wait_for_timeout(1000)

        # 4. Aim Down Sights (ADS) screenshot with Red Dot mounted & Laser beam active
        # Dispatch mouse right click down on canvas
        canvas = page.locator("#canvas-container")
        box = await canvas.bounding_box()
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down(button="right")
        await page.wait_for_timeout(600)
        await page.screenshot(path="/home/jules/verification/screenshots/ads_reddot_laser.png")
        await page.mouse.up(button="right")

        # 5. Wait for enemies to advance into melee range and capture melee attack animation
        await page.wait_for_timeout(3500)
        await page.screenshot(path="/home/jules/verification/screenshots/enemy_melee_combat.png")

        await browser.close()

    server.terminate()

if __name__ == "__main__":
    asyncio.run(main())
