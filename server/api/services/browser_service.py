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

async def probe_page(url: str) -> dict:
    """
    Open *url* in a headless browser and auto-discover chat widget selectors.

    Strategy:
    1. Load the page and wait for JS to settle.
    2. Try to click common "open chat" launcher buttons.
    3. Scan the main frame AND any iframes for candidate inputs, send
       buttons, and response containers.
    4. Score every candidate by how chat-like it looks.
    5. Return the top suggestions + a screenshot for visual verification.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {
            "success": False,
            "error": "Playwright is not installed. Run: pip install playwright && playwright install chromium",
        }

    # ── Pattern libraries ─────────────────────────────────────────────────────

    # Selectors tried in order to open a chat launcher before scanning
    LAUNCHER_SELECTORS = [
        "[id*='chat'][class*='button' i]",
        "[class*='chat-launcher' i]",
        "[class*='chat-button' i]",
        "[class*='launcher' i]",
        "[aria-label*='chat' i]",
        "[aria-label*='help' i]",
        "[title*='chat' i]",
        "[id*='launcher' i]",
        "[id*='chat-button' i]",
        "button[class*='fab' i]",
        "[data-testid*='chat' i]",
        # LivePerson
        "#lpChat .lp-btn-chat",
        # Salesforce MIAW
        ".embeddedServiceHelpButton button",
        # Genesys
        ".cx-widget.cx-webchat-launcher",
        # Intercom
        ".intercom-launcher",
        # Zendesk
        "#launcher",
    ]

    # Candidate input selectors scored by specificity
    INPUT_PATTERNS = [
        ("input[placeholder*='message' i]", 10),
        ("textarea[placeholder*='message' i]", 10),
        ("input[placeholder*='type' i]", 9),
        ("textarea[placeholder*='type' i]", 9),
        ("input[placeholder*='ask' i]", 9),
        ("textarea[placeholder*='ask' i]", 9),
        ("input[placeholder*='chat' i]", 8),
        ("textarea[placeholder*='chat' i]", 8),
        ("input[id*='message' i]", 7),
        ("textarea[id*='message' i]", 7),
        ("input[id*='chat' i]", 7),
        ("textarea[id*='chat' i]", 7),
        ("input[id*='input' i]", 6),
        ("textarea[id*='input' i]", 6),
        ("input[name*='message' i]", 6),
        ("[contenteditable='true']", 5),
        ("input[class*='message' i]", 5),
        ("textarea[class*='message' i]", 5),
        ("input[class*='chat' i]", 5),
        ("textarea[class*='chat' i]", 5),
        # Salesforce MIAW
        ("input[name='userInput']", 10),
        # Genesys
        ("input.cx-message", 10),
        # LivePerson
        ("#lp-msga", 10),
        # Intercom
        (".intercom-composer-input", 10),
        # Zendesk
        ("#Embed textarea", 10),
    ]

    SEND_PATTERNS = [
        ("button[aria-label*='send' i]", 10),
        ("button[title*='send' i]", 10),
        ("[data-testid*='send' i]", 10),
        ("button[type='submit']", 7),
        ("button[class*='send' i]", 8),
        ("button[id*='send' i]", 8),
        ("[aria-label*='submit' i]", 7),
        # Salesforce MIAW
        ("button[title='Send']", 10),
        # Genesys
        ("button.cx-send", 10),
        # LivePerson
        ("#send_button", 10),
        # Intercom
        ("button[data-testid='send-button']", 10),
        # Zendesk
        ("#Embed button[type='submit']", 10),
    ]

    RESPONSE_PATTERNS = [
        (".slds-chat-listitem_inbound .slds-chat-message__text", 10),  # Salesforce MIAW
        ("[data-testid='message-text']", 9),  # Intercom
        (".cx-transcript .agent .cx-message", 9),  # Genesys
        (".bot-message", 8),
        (".assistant-message", 8),
        (".agent-message", 8),
        ("[data-sender='agent']", 8),
        ("[data-role='bot']", 8),
        ("[data-author-type='agent' i]", 7),
        (".chat-message:not(.user-message)", 6),
        (".message[class*='bot' i]", 6),
        (".message[class*='agent' i]", 6),
        # Zendesk
        ("[data-garden-id='chat.message'] [data-garden-id='typography.paragraph']", 9),
        # LivePerson
        (".lpview_message_area .agent-avatar ~ .message-content", 7),
    ]

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        try:
            try:
                await page.goto(url, wait_until="networkidle", timeout=30_000)
            except Exception:
                await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
                await page.wait_for_timeout(3000)

            await page.wait_for_timeout(2000)

            # ── Step 1: Try to open the chat launcher ─────────────────────
            launcher_clicked = None
            for sel in LAUNCHER_SELECTORS:
                try:
                    el = await page.query_selector(sel)
                    if el and await el.is_visible():
                        await el.click()
                        launcher_clicked = sel
                        await page.wait_for_timeout(2000)
                        break
                except Exception:
                    pass

            # ── Step 2: Collect all frames (main + iframes) ────────────────
            frames_to_scan = []  # list of (frame_or_page, iframe_selector_or_None)
            frames_to_scan.append((page, None))

            iframe_els = await page.query_selector_all("iframe")
            for iframe_el in iframe_els:
                try:
                    frame = await iframe_el.content_frame()
                    if frame:
                        # Get a useful selector for this iframe
                        src = await iframe_el.get_attribute("src") or ""
                        id_ = await iframe_el.get_attribute("id") or ""
                        cls = await iframe_el.get_attribute("class") or ""
                        name = await iframe_el.get_attribute("name") or ""
                        if id_:
                            sel = f"iframe#{id_}"
                        elif name:
                            sel = f"iframe[name='{name}']"
                        elif "chat" in src.lower() or "chat" in cls.lower():
                            sel = f"iframe[src*='{src.split('?')[0].split('/')[-1]}']" if src else "iframe"
                        else:
                            sel = None  # not worth tracking
                        frames_to_scan.append((frame, sel))
                except Exception:
                    pass

            # ── Step 3: Scan frames for candidates ─────────────────────────
            best: dict = {
                "input": None, "send": None, "response": None, "iframe": None,
            }
            all_candidates: dict = {"input": [], "send": [], "response": []}

            for frame, iframe_sel in frames_to_scan:
                for patterns, category in [
                    (INPUT_PATTERNS, "input"),
                    (SEND_PATTERNS, "send"),
                    (RESPONSE_PATTERNS, "response"),
                ]:
                    for sel, score in patterns:
                        try:
                            els = await frame.query_selector_all(sel)
                            visible = []
                            for el in els:
                                try:
                                    if await el.is_visible():
                                        visible.append(el)
                                except Exception:
                                    pass
                            if visible:
                                # Get extra info for display
                                el = visible[0]
                                placeholder = ""
                                text = ""
                                try:
                                    placeholder = await el.get_attribute("placeholder") or ""
                                except Exception:
                                    pass
                                try:
                                    text = (await el.inner_text())[:60] or ""
                                except Exception:
                                    pass
                                candidate = {
                                    "selector": sel,
                                    "score": score + (5 if iframe_sel else 0),  # iframe bonus
                                    "count": len(visible),
                                    "placeholder": placeholder,
                                    "text": text.strip(),
                                    "iframe": iframe_sel,
                                }
                                all_candidates[category].append(candidate)
                                # Update best if higher score
                                if best[category] is None or candidate["score"] > best[category]["score"]:
                                    best[category] = candidate
                                    if iframe_sel:
                                        best["iframe"] = iframe_sel
                        except Exception:
                            pass

            # ── Step 4: Screenshot ─────────────────────────────────────────
            import base64
            png = await page.screenshot(type="png", full_page=False)
            screenshot_b64 = base64.b64encode(png).decode()

            # ── Step 5: Build response ─────────────────────────────────────
            suggested = {
                "input_selector": best["input"]["selector"] if best["input"] else "",
                "send_selector": best["send"]["selector"] if best["send"] else "Enter",
                "response_selector": best["response"]["selector"] if best["response"] else "",
                "iframe_selector": best["iframe"] or "",
                "load_wait_ms": 2000,
                "wait_after_send_ms": 5000,
            }

            return {
                "success": True,
                "url": url,
                "launcher_clicked": launcher_clicked,
                "suggested": suggested,
                "candidates": {
                    cat: sorted(cands, key=lambda x: -x["score"])[:5]
                    for cat, cands in all_candidates.items()
                },
                "screenshot_b64": screenshot_b64,
            }

        except Exception as e:
            import base64
            screenshot_b64 = None
            try:
                png = await page.screenshot(type="png")
                screenshot_b64 = base64.b64encode(png).decode()
            except Exception:
                pass
            return {
                "success": False,
                "error": str(e),
                "screenshot_b64": screenshot_b64,
            }
        finally:
            await browser.close()


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
