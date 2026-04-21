"""Take screenshots of the running Priest app to show current visual state.

Expects:
  - Worker on http://localhost:8787
  - Vite on http://localhost:5173

Usage:
    python scripts/snapshot.py
"""

from __future__ import annotations
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent.parent / "snapshots"
OUT.mkdir(exist_ok=True)

WIDTH, HEIGHT = 1440, 900


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            # Force hardware-ish GL so WebGL works in headless chromium
            args=[
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
            ],
        )
        ctx = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1,
        )
        page = ctx.new_page()
        page.on("console", lambda msg: print(f"  [browser {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"  [browser error] {err}"))
        page.goto("http://localhost:5173/", wait_until="networkidle")
        # Give WebGL + GLB load + breathe keyframe a moment
        page.wait_for_timeout(2500)

        page.screenshot(path=str(OUT / "01_rest.png"), full_page=False)
        print(f"  wrote {OUT / '01_rest.png'}")

        # Send a greeting so the priest responds and we can catch visemes
        page.get_by_placeholder("Speak your mind").fill(
            "Good morning, Father. Tell me about the weather today."
        )
        page.keyboard.press("Enter")

        # Sample the stage a handful of times while the reply streams.
        for i, delay_ms in enumerate((600, 1100, 1700, 2400, 3200, 4200, 5500), start=2):
            page.wait_for_timeout(delay_ms - (delay_ms - 500 if i == 2 else 0))
            path = OUT / f"{i:02d}_streaming_{delay_ms}ms.png"
            page.screenshot(path=str(path), full_page=False)
            print(f"  wrote {path}")

        browser.close()


if __name__ == "__main__":
    main()
