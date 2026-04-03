"""
Browser Automation connector — drives a real browser with Playwright.

Sends questions to any web-based chatbot by typing into the UI and
scraping the response, with no API key or signup required.

Agent config shape (stored in agents.config):
{
  "url":              "https://www.stanford.edu/admissions",  # page to open
  "input_selector":   "#chat-input",        # CSS selector for text input
  "send_selector":    "#chat-send",         # CSS selector for send button
  "response_selector":"[data-role='bot-message']", # last bot msg selector
  "iframe_selector":  null,                 # CSS selector for chat iframe (if any)
  "load_wait_ms":     2000,                 # ms to wait after page load
  "wait_after_send_ms": 5000,               # ms to wait for bot to reply
  "clear_input":      true,                 # clear input box before typing
}

Connection config: nothing needed — leave config=null.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class BrowserServiceError(Exception):
    pass


class BrowserSession:
    """
    Keeps a Playwright browser and page open for the duration of a test run
    so the chat session (history/cookies) persists across questions.
    """

    def __init__(self, agent_config: dict):
        self._cfg = agent_config
        self._playwright = None
        self._browser = None
        self._page = None
        self._frame = None  # set when an iframe is involved

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(self) -> None:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise BrowserServiceError(
                "Playwright is not installed. Run: pip install playwright && playwright install chromium"
            )

        url = (self._cfg.get("url") or "").strip()
        if not url:
            raise BrowserServiceError("Browser agent has no URL configured. Edit the agent and set the Page URL.")

        load_wait_ms = int(self._cfg.get("load_wait_ms") or 2000)
        iframe_selector: Optional[str] = (self._cfg.get("iframe_selector") or "").strip() or None

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        self._page = await context.new_page()

        try:
            await self._page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        except Exception as e:
            raise BrowserServiceError(f"Failed to load {url}: {e}")

        await self._page.wait_for_timeout(load_wait_ms)

        # Resolve iframe target once — stays valid for the whole session
        if iframe_selector:
            try:
                frame_el = await self._page.wait_for_selector(iframe_selector, timeout=10_000)
                self._frame = await frame_el.content_frame()
                if not self._frame:
                    raise BrowserServiceError(f"Selector '{iframe_selector}' found but is not an iframe")
            except Exception as e:
                raise BrowserServiceError(f"Cannot locate iframe '{iframe_selector}': {e}")
        else:
            self._frame = self._page

    async def close(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
        except Exception:
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._playwright = self._browser = self._page = self._frame = None

    # ── Messaging ─────────────────────────────────────────────────────────────

    async def send_message(self, question: str) -> str:
        if not self._frame:
            raise BrowserServiceError("Browser session not started")

        input_sel: str = (self._cfg.get("input_selector") or "").strip()
        send_sel: str = (self._cfg.get("send_selector") or "").strip()
        resp_sel: str = (self._cfg.get("response_selector") or "").strip()
        wait_ms = int(self._cfg.get("wait_after_send_ms") or 5000)
        clear_input: bool = self._cfg.get("clear_input", True)

        if not input_sel or not send_sel or not resp_sel:
            raise BrowserServiceError(
                "Missing selectors — edit the agent and fill in: "
                "Input Selector, Send Selector, Response Selector."
            )

        # Count existing bot messages before we send
        try:
            existing_els = await self._frame.query_selector_all(resp_sel)
            existing_count = len(existing_els)
        except Exception:
            existing_count = 0

        # Find and fill the input box
        try:
            input_el = await self._frame.wait_for_selector(input_sel, state="visible", timeout=10_000)
        except Exception as e:
            raise BrowserServiceError(f"Input box not found (selector: '{input_sel}'): {e}")

        if clear_input:
            await input_el.fill("")
        await input_el.fill(question)

        # Click the send button (or press Enter if selector is "Enter")
        if send_sel.lower() in ("enter", "return"):
            await input_el.press("Enter")
        else:
            try:
                send_el = await self._frame.wait_for_selector(send_sel, state="visible", timeout=5_000)
                await send_el.click()
            except Exception as e:
                # Fallback: press Enter
                logger.warning("Send button not found ('%s'), pressing Enter: %s", send_sel, e)
                await input_el.press("Enter")

        # Wait for a new response element to appear (polling up to wait_ms)
        await self._poll_for_new_response(resp_sel, existing_count, wait_ms)

        # Extract text from the last matching element
        try:
            all_els = await self._frame.query_selector_all(resp_sel)
            if not all_els:
                return "(no response elements found)"
            last_el = all_els[-1]
            text = await last_el.inner_text()
            return text.strip() or "(empty response)"
        except Exception as e:
            raise BrowserServiceError(f"Failed to extract response text: {e}")

    async def _poll_for_new_response(self, selector: str, prior_count: int, timeout_ms: int) -> None:
        """Poll until a new element matching *selector* appears, or timeout."""
        import asyncio
        poll_interval = 500  # ms
        elapsed = 0
        while elapsed < timeout_ms:
            await asyncio.sleep(poll_interval / 1000)
            elapsed += poll_interval
            try:
                els = await self._frame.query_selector_all(selector)
                if len(els) > prior_count:
                    # New message appeared — give it a short extra time to finish rendering
                    await asyncio.sleep(0.3)
                    return
            except Exception:
                pass
        # Timeout — return anyway and let the caller read whatever is there

    async def take_screenshot(self) -> bytes:
        """Return a PNG screenshot of the current page (for debugging)."""
        if not self._page:
            raise BrowserServiceError("No page open")
        return await self._page.screenshot(type="png", full_page=False)


# ── Stateless helper for a single-shot message (no session reuse) ──────────

async def send_browser_message_once(agent_config: dict, question: str) -> str:
    """Send one message and close the browser. Useful for quick tests."""
    session = BrowserSession(agent_config)
    await session.start()
    try:
        return await session.send_message(question)
    finally:
        await session.close()


# ── Connection test ─────────────────────────────────────────────────────────

async def test_browser_connection(agent_config: dict) -> dict:
    """
    Open the URL, take a screenshot, return reachability info.
    Does NOT attempt to interact with the chat widget.
    """
    import base64
    session = BrowserSession(agent_config)
    try:
        await session.start()
        png = await session.take_screenshot()
        return {
            "success": True,
            "message": f"Page loaded: {agent_config.get('url')}",
            "screenshot_b64": base64.b64encode(png).decode(),
        }
    except BrowserServiceError as e:
        return {"success": False, "message": str(e), "screenshot_b64": None}
    except Exception as e:
        return {"success": False, "message": f"Unexpected error: {e}", "screenshot_b64": None}
    finally:
        await session.close()
