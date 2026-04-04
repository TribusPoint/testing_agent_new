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

        # Same web crawl as UI "Discover" — fills missing selectors before loading.
        self._cfg = await ensure_browser_selectors(dict(self._cfg))

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
    1. Load page, wait for JS + lazy scripts to settle.
    2. Scan ALL iframes (chat widgets usually live in iframes).
    3. Try every launcher pattern; after each click wait and re-scan.
    4. Also try clicking by position (bottom-right corner) as a fallback.
    5. Dump every input/button/textarea in each frame for deep inspection.
    6. Return ranked candidates + screenshot.
    """
    import base64
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {
            "success": False,
            "error": "Playwright is not installed. Run: pip install playwright && playwright install chromium",
        }

    # ── Known platform patterns ───────────────────────────────────────────────

    LAUNCHER_SELECTORS = [
        # Microsoft Dynamics 365 Omnichannel Live Chat (e.g. Cleveland Clinic)
        "#Microsoft_Omnichannel_LCWidget_Chat_Button",
        "[id^='Microsoft_Omnichannel_LCWidget' i]",
        "[id*='Omnichannel_LCWidget' i]",
        "button[id*='LCWidget' i]",
        "div[id*='LCWidget' i][role='button']",
        "[id*='LCWidget_Chat' i][role='button']",
        # Custom care / CTA strip that triggers Omnichannel
        "section#call-out-panel button",
        ".js-care-widget button",
        ".care-widget button",
        "[class*='js-care-widget' i] button",
        "[class*='care-widget' i] a",
        # Salesforce MIAW / embedded service
        ".embeddedServiceHelpButton button",
        ".helpButtonEnabled",
        "[class*='embeddedService' i] button",
        # LivePerson
        "#lpChat",
        "[id*='LP_DIV' i]",
        ".LPMcontainer",
        # Genesys
        ".cx-widget.cx-webchat-launcher",
        "[class*='genesys' i][class*='launcher' i]",
        # Intercom
        ".intercom-launcher",
        "[class*='intercom' i][class*='launcher' i]",
        # Zendesk
        "#launcher",
        "[data-testid='launcher']",
        # Nuance (common in healthcare)
        "[id*='nuance' i]",
        "[class*='nuance' i][class*='chat' i]",
        # Generic patterns
        "[aria-label*='chat' i]",
        "[aria-label*='live chat' i]",
        "[aria-label*='help' i]",
        "[title*='chat' i]",
        "[id*='chat-button' i]",
        "[id*='chatButton' i]",
        "[id*='launcher' i]",
        "[class*='chat-launcher' i]",
        "[class*='chat-button' i]",
        "[class*='chatButton' i]",
        "[class*='launcher' i]",
        "button[class*='fab' i]",
        "[data-testid*='chat' i]",
        "[data-widget*='chat' i]",
    ]

    INPUT_PATTERNS = [
        # Microsoft Bot Framework Web Chat (inside Omnichannel iframe)
        ("textarea.webchat__send-box-text-box__input", 16),
        ("input.webchat__send-box-text-box__input", 16),
        (".webchat__send-box textarea", 15),
        (".webchat__send-box input[type='text']", 14),
        ("[class*='webchat'][class*='send-box' i] textarea", 14),
        ("textarea[aria-label*='message' i]", 12),
        ("input[aria-label*='message' i]", 12),
        ("textarea[aria-label*='type' i]", 11),
        # Salesforce MIAW
        ("input[name='userInput']", 15),
        (".slds-chat-composer input", 13),
        ("input[class*='slds'][class*='input' i]", 12),
        # Genesys
        ("input.cx-message", 15),
        ("textarea.cx-message", 15),
        # LivePerson
        ("#lp-msga", 15),
        ("#lpChat input[type='text']", 14),
        # Intercom
        (".intercom-composer-input", 15),
        # Zendesk
        ("#Embed textarea", 15),
        ("[data-garden-id='chat.input'] textarea", 13),
        # Nuance
        ("[id*='nuance' i] input[type='text']", 13),
        # Generic chat-like inputs
        ("input[placeholder*='message' i]", 10),
        ("textarea[placeholder*='message' i]", 10),
        ("input[placeholder*='type' i]", 9),
        ("textarea[placeholder*='type' i]", 9),
        ("input[placeholder*='ask' i]", 9),
        ("textarea[placeholder*='ask' i]", 9),
        ("input[placeholder*='question' i]", 9),
        ("textarea[placeholder*='question' i]", 9),
        ("input[placeholder*='chat' i]", 8),
        ("textarea[placeholder*='chat' i]", 8),
        ("input[placeholder*='help' i]", 7),
        ("textarea[placeholder*='help' i]", 7),
        ("input[id*='message' i]", 7),
        ("textarea[id*='message' i]", 7),
        ("input[id*='chat' i]", 7),
        ("textarea[id*='chat' i]", 7),
        ("[contenteditable='true']", 5),
        ("input[class*='message' i]", 5),
        ("textarea[class*='message' i]", 5),
    ]

    SEND_PATTERNS = [
        # Microsoft Bot Framework Web Chat
        ("button.webchat__send-button", 16),
        (".webchat__send-button", 15),
        ("[class*='webchat'][class*='send-button' i]", 14),
        # Salesforce MIAW
        ("button[title='Send']", 15),
        (".slds-chat-composer button[type='submit']", 13),
        # Genesys
        ("button.cx-send", 15),
        # LivePerson
        ("#send_button", 15),
        # Intercom
        ("button[data-testid='send-button']", 15),
        # Zendesk
        ("#Embed button[type='submit']", 15),
        # Generic
        ("button[aria-label*='send' i]", 10),
        ("button[title*='send' i]", 10),
        ("[data-testid*='send' i]", 10),
        ("button[class*='send' i]", 8),
        ("button[id*='send' i]", 8),
        ("button[type='submit']", 6),
        ("[aria-label*='submit' i]", 6),
    ]

    RESPONSE_PATTERNS = [
        # Microsoft Bot Framework Web Chat (bot / system messages)
        (".webchat__bubble__content", 15),
        ("[class*='webchat'][class*='bubble__content' i]", 14),
        (".webchat__basic-transcript__activity-body", 13),
        ("[class*='webchat'][class*='activity-body' i]", 12),
        (".webchat__stacked-layout__content", 12),
        # Salesforce MIAW
        (".slds-chat-listitem_inbound .slds-chat-message__text", 15),
        (".slds-chat-listitem--inbound .slds-chat-message__text", 15),
        # Intercom
        ("[data-testid='message-text']", 13),
        # Genesys
        (".cx-transcript .agent .cx-message", 13),
        (".cx-message.agent", 12),
        # Zendesk
        ("[data-garden-id='chat.message']", 12),
        # Generic
        (".bot-message", 8),
        (".assistant-message", 8),
        (".agent-message", 8),
        ("[data-sender='agent']", 8),
        ("[data-role='bot']", 8),
        ("[data-author-type='agent' i]", 7),
        (".message[class*='bot' i]", 6),
        (".message[class*='agent' i]", 6),
    ]

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        log_lines: list[str] = []

        try:
            # ── 1. Load page ──────────────────────────────────────────────
            log_lines.append(f"Loading {url} …")
            try:
                await page.goto(url, wait_until="networkidle", timeout=35_000)
            except Exception:
                await page.goto(url, wait_until="domcontentloaded", timeout=25_000)
                await page.wait_for_timeout(4000)

            # Extra wait for lazy-loaded scripts / chat SDKs
            await page.wait_for_timeout(4000)
            log_lines.append("Page loaded. Scanning iframes and main frame.")

            # ── 2. Build frame list (DOM iframes + Playwright page.frames for Omnichannel) ──
            async def collect_frames():
                frames: list = [(page, None, "main")]
                seen: set[int] = set()

                def _add(fr, isel, label: str) -> None:
                    fid = id(fr)
                    if fid in seen:
                        return
                    seen.add(fid)
                    frames.append((fr, isel, label))

                try:
                    all_iframes = await page.query_selector_all("iframe")
                    for el in all_iframes:
                        try:
                            f = await el.content_frame()
                            if not f:
                                continue
                            src = await el.get_attribute("src") or ""
                            id_ = await el.get_attribute("id") or ""
                            name = await el.get_attribute("name") or ""
                            cls = await el.get_attribute("class") or ""
                            title = await el.get_attribute("title") or ""
                            if id_:
                                isel = f"iframe#{id_}"
                            elif name:
                                isel = f"iframe[name='{name}']"
                            elif title:
                                isel = f"iframe[title='{title}']"
                            else:
                                isel = "iframe"
                            label = f"iframe src={src[:60]} id={id_} cls={cls[:40]}"
                            _add(f, isel, label)
                        except Exception:
                            pass
                except Exception:
                    pass

                # Child frames not always tied to <iframe> element timing (MS Live Chat)
                try:
                    for fr in page.frames:
                        if fr == page.main_frame:
                            continue
                        url_f = (fr.url or "").lower()
                        if any(
                            k in url_f
                            for k in (
                                "livechatwidget",
                                "azureedge.net",
                                "oc-cdn",
                                "omnichannel",
                                "directline",
                                "botframework",
                            )
                        ):
                            _add(fr, None, f"pw-frame:{(fr.url or '')[:80]}")
                except Exception:
                    pass

                return frames

            async def wait_for_chat_iframe():
                """Omnichannel injects iframe after CTA click; wait for Azure CDN widget."""
                try:
                    await page.wait_for_selector(
                        "iframe[id*='LCWidget' i], iframe[id*='Omnichannel' i], "
                        "iframe[src*='livechatwidget' i], iframe[src*='azureedge' i]",
                        timeout=15000,
                    )
                except Exception:
                    pass
                await page.wait_for_timeout(4000)

            async def try_click_chat_by_text() -> str | None:
                """Omnichannel uses visible text like 'Let's Chat!' — CSS selectors often miss."""
                for label in (
                    "Let's Chat!",
                    "Let's Chat",
                    "Let’s Chat",  # curly apostrophe (U+2019)
                    "Chat with us",
                    "Live chat",
                    "Start chat",
                    "Chat now",
                ):
                    try:
                        loc = page.get_by_role("button", name=label, exact=False)
                        if await loc.count() > 0:
                            first = loc.first
                            if await first.is_visible():
                                await first.click(timeout=5000)
                                return f"role:button:{label}"
                    except Exception:
                        pass
                    try:
                        loc = page.get_by_text(label, exact=False)
                        if await loc.count() > 0:
                            first = loc.first
                            if await first.is_visible():
                                await first.click(timeout=5000)
                                return f"text:{label}"
                    except Exception:
                        pass
                return None

            frames_to_scan = await collect_frames()
            log_lines.append(f"Found {len(frames_to_scan)} frames (including main).")

            # ── 3. Open chat: CSS launchers → text ("Let's Chat!") → bottom-right ──
            launcher_clicked = None
            for sel in LAUNCHER_SELECTORS:
                try:
                    el = await page.query_selector(sel)
                    if el and await el.is_visible():
                        await el.click(timeout=5000)
                        launcher_clicked = sel
                        log_lines.append(f"Clicked launcher: {sel}")
                        break
                except Exception:
                    pass

            if launcher_clicked:
                await wait_for_chat_iframe()
                frames_to_scan = await collect_frames()

            if not launcher_clicked:
                launcher_clicked = await try_click_chat_by_text()
                if launcher_clicked:
                    log_lines.append(f"Clicked launcher: {launcher_clicked}")
                    await wait_for_chat_iframe()
                    frames_to_scan = await collect_frames()

            # Fallback: any clickable in bottom-right (FAB / care strip)
            if not launcher_clicked:
                try:
                    clicked_br = await page.evaluate("""() => {
                        const vw = window.innerWidth, vh = window.innerHeight;
                        const zone = { x0: vw*0.55, y0: vh*0.65, x1: vw, y1: vh };
                        const sel = 'button, [role="button"], a, div[tabindex="0"], '
                          + '[class*="care-widget"] button, [class*="care-widget"] a, '
                          + 'section#call-out-panel button, section#call-out-panel a';
                        const els = document.querySelectorAll(sel);
                        for (const el of els) {
                            const t = (el.innerText || '').trim();
                            if (t.length > 40) continue;
                            const r = el.getBoundingClientRect();
                            if (r.width > 8 && r.height > 8 &&
                                r.right > zone.x0 && r.bottom > zone.y0 &&
                                r.left < zone.x1 && r.top < zone.y1) {
                                el.click();
                                return (t || el.tagName) + ' :: ' + el.outerHTML.slice(0, 100);
                            }
                        }
                        return null;
                    }""")
                    if clicked_br:
                        launcher_clicked = f"[bottom-right] {clicked_br}"
                        log_lines.append(f"Clicked bottom-right: {clicked_br[:80]}")
                        await wait_for_chat_iframe()
                        frames_to_scan = await collect_frames()
                except Exception:
                    pass

            # ── 4. Dump all inputs/textareas/buttons in all frames ─────────
            # This catches things our pattern list misses
            async def dump_frame_elements(frame, iframe_sel, label):
                """Return all visible inputs and buttons with their attrs."""
                found = {"inputs": [], "buttons": []}
                try:
                    raw = await frame.evaluate("""() => {
                        function attrs(el) {
                            const o = {};
                            for (const a of el.attributes) o[a.name] = a.value;
                            return o;
                        }
                        const r = { inputs: [], buttons: [] };
                        for (const el of document.querySelectorAll('input, textarea, [contenteditable="true"]')) {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 10 && rect.height > 10)
                                r.inputs.push({ tag: el.tagName, attrs: attrs(el), rect: {w: rect.width, h: rect.height} });
                        }
                        for (const el of document.querySelectorAll('button, [role="button"]')) {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 5 && rect.height > 5)
                                r.buttons.push({ tag: el.tagName, attrs: attrs(el), text: el.innerText.trim().slice(0, 40), rect: {w: rect.width, h: rect.height} });
                        }
                        return r;
                    }""")
                    found["inputs"] = raw.get("inputs", [])[:20]
                    found["buttons"] = raw.get("buttons", [])[:20]
                    log_lines.append(f"  {label}: {len(found['inputs'])} inputs, {len(found['buttons'])} buttons")
                except Exception as e:
                    log_lines.append(f"  {label}: dump failed — {e}")
                return found

            all_dumps = {}
            for frame, iframe_sel, label in frames_to_scan:
                dump = await dump_frame_elements(frame, iframe_sel, label)
                all_dumps[label] = {"dump": dump, "iframe_sel": iframe_sel}

            # ── 5. Score candidates using pattern lists ────────────────────
            best: dict = {"input": None, "send": None, "response": None, "iframe": None}
            all_candidates: dict = {"input": [], "send": [], "response": []}

            for frame, iframe_sel, label in frames_to_scan:
                for patterns, category in [
                    (INPUT_PATTERNS, "input"),
                    (SEND_PATTERNS, "send"),
                    (RESPONSE_PATTERNS, "response"),
                ]:
                    for sel, score in patterns:
                        try:
                            els = await frame.query_selector_all(sel)
                            found_any = len(els) > 0
                            # Count visible ones; but accept hidden too if in iframe
                            visible_count = 0
                            for el in els:
                                try:
                                    if await el.is_visible():
                                        visible_count += 1
                                except Exception:
                                    pass
                            effective_count = visible_count or (len(els) if iframe_sel else 0)
                            if effective_count == 0 and not found_any:
                                continue

                            el = els[0]
                            placeholder = ""
                            text = ""
                            try:
                                placeholder = await el.get_attribute("placeholder") or ""
                            except Exception:
                                pass
                            try:
                                text = (await el.inner_text())[:60]
                            except Exception:
                                pass

                            # Bonus for iframe (chat widgets commonly in iframes)
                            iframe_bonus = 5 if iframe_sel else 0
                            candidate = {
                                "selector": sel,
                                "score": score + iframe_bonus,
                                "count": effective_count,
                                "placeholder": placeholder,
                                "text": text.strip(),
                                "iframe": iframe_sel,
                                "frame_label": label,
                            }
                            all_candidates[category].append(candidate)
                            if best[category] is None or candidate["score"] > best[category]["score"]:
                                best[category] = candidate
                                if iframe_sel:
                                    best["iframe"] = iframe_sel
                        except Exception:
                            pass

            # ── 6. Build "raw dump" candidates from actual page elements ───
            # Synthesise selectors from the dump for anything the patterns missed
            for label, data in all_dumps.items():
                dump = data["dump"]
                iframe_sel = data["iframe_sel"]
                for inp in dump["inputs"]:
                    attrs = inp.get("attrs", {})
                    # Build a selector from attrs
                    sel_parts = []
                    tag = inp["tag"].lower()
                    for attr in ["id", "name", "class", "placeholder", "aria-label"]:
                        v = attrs.get(attr, "").strip()
                        if v and len(v) < 80:
                            if attr == "id":
                                sel_parts.append(f"{tag}#{v.split()[0]}")
                                break
                            elif attr == "name":
                                sel_parts.append(f"{tag}[name='{v}']")
                                break
                    if not sel_parts:
                        continue
                    sel = sel_parts[0]
                    placeholder = attrs.get("placeholder", "")
                    # Score based on placeholder content
                    ph_lower = placeholder.lower()
                    score = 0
                    for kw, pts in [("message",9),("type",8),("ask",8),("question",8),("chat",7),("help",6),("search",2)]:
                        if kw in ph_lower:
                            score = max(score, pts)
                    if score == 0:
                        score = 3  # generic fallback
                    candidate = {
                        "selector": sel,
                        "score": score + (5 if iframe_sel else 0),
                        "count": 1,
                        "placeholder": placeholder,
                        "text": "",
                        "iframe": iframe_sel,
                        "frame_label": label,
                        "raw": True,
                    }
                    # Only add if not already in candidates
                    if not any(c["selector"] == sel for c in all_candidates["input"]):
                        all_candidates["input"].append(candidate)
                        if best["input"] is None or candidate["score"] > best["input"]["score"]:
                            best["input"] = candidate
                            if iframe_sel:
                                best["iframe"] = iframe_sel

            # ── 6b. Detect Omnichannel parent iframe (before fallbacks) ─────
            omni_iframe_sel = ""
            try:
                ms_if_el = await page.query_selector(
                    "iframe[id*='LCWidget' i], iframe[id*='Omnichannel' i], "
                    "iframe[src*='livechatwidget' i], iframe[src*='azureedge' i]"
                )
                if ms_if_el:
                    iid = await ms_if_el.get_attribute("id")
                    if iid:
                        omni_iframe_sel = f"iframe#{iid}"
                        log_lines.append(f"Omnichannel iframe selector: {omni_iframe_sel}")
            except Exception:
                pass

            # ── 6c. Fallbacks: Bot Framework / Omnichannel often show NO bot bubbles
            #     until after the first user message — probe would only find 1–2 types.
            _meta = {"placeholder": "", "text": "", "iframe": best["iframe"], "frame_label": ""}

            if best["input"] and not best["send"]:
                best["send"] = {
                    "selector": "Enter", "score": 6, "count": 1, **_meta,
                }
                log_lines.append("Inferred send selector: Enter (no send button matched).")

            def _looks_like_webchat() -> bool:
                if omni_iframe_sel:
                    return True
                lc = str(launcher_clicked or "")
                if "omnichannel" in lc.lower() or "lcwidget" in lc.lower():
                    return True
                inp_sel = ((best["input"] or {}).get("selector") or "").lower()
                if "webchat" in inp_sel:
                    return True
                for cat in ("input", "send"):
                    for c in all_candidates.get(cat, [])[:5]:
                        if "webchat" in (c.get("selector") or "").lower():
                            return True
                return False

            if best["input"] and best["send"] and not best["response"]:
                if _looks_like_webchat():
                    best["response"] = {
                        "selector": ".webchat__bubble__content",
                        "score": 12,
                        "count": 0,
                        **_meta,
                        "frame_label": "(inferred — Web Chat bubbles after first send)",
                    }
                    log_lines.append(
                        "Inferred response selector: .webchat__bubble__content "
                        "(widget had no visible bot messages during probe)."
                    )
                else:
                    # Generic: many widgets append new rows; user can refine in UI
                    best["response"] = {
                        "selector": "[role='log'] [role='article'], [role='listitem'], .message, .chat-message",
                        "score": 4,
                        "count": 0,
                        **_meta,
                        "frame_label": "(inferred — generic transcript)",
                    }
                    log_lines.append(
                        "Inferred generic response selector (no bot text visible during probe)."
                    )

            # ── 7. Screenshot ──────────────────────────────────────────────
            png = await page.screenshot(type="png", full_page=False)
            screenshot_b64 = base64.b64encode(png).decode()

            found_count = sum(1 for k in ["input", "send", "response"] if best[k])
            log_lines.append(f"Done. Found {found_count}/3 selector types (after fallbacks).")

            suggested = {
                "input_selector": best["input"]["selector"] if best["input"] else "",
                "send_selector": best["send"]["selector"] if best["send"] else "",
                "response_selector": best["response"]["selector"] if best["response"] else "",
                "iframe_selector": (best["iframe"] or omni_iframe_sel) or "",
                "load_wait_ms": 4500,
                "wait_after_send_ms": 8000,
            }

            return {
                "success": True,
                "found_count": found_count,
                "url": url,
                "launcher_clicked": launcher_clicked,
                "suggested": suggested,
                "candidates": {
                    cat: sorted(cands, key=lambda x: -x["score"])[:5]
                    for cat, cands in all_candidates.items()
                },
                "raw_dump": {
                    label: {
                        "inputs": data["dump"]["inputs"][:8],
                        "buttons": data["dump"]["buttons"][:8],
                        "iframe_sel": data["iframe_sel"],
                    }
                    for label, data in all_dumps.items()
                },
                "log": log_lines,
                "screenshot_b64": screenshot_b64,
            }

        except Exception as e:
            screenshot_b64 = None
            try:
                png = await page.screenshot(type="png")
                screenshot_b64 = base64.b64encode(png).decode()
            except Exception:
                pass
            return {
                "success": False,
                "found_count": 0,
                "error": str(e),
                "log": log_lines,
                "screenshot_b64": screenshot_b64,
            }
        finally:
            await browser.close()


async def ensure_browser_selectors(cfg: dict) -> dict:
    """
    If any of input / send / response selectors are missing, run *probe_page*
    (the same crawl as the UI Discover button) and merge non-empty suggestions.

    This lets chat and test runs work when only the Page URL is saved.
    """
    out = dict(cfg)

    def complete() -> bool:
        return bool(
            (out.get("input_selector") or "").strip()
            and (out.get("send_selector") or "").strip()
            and (out.get("response_selector") or "").strip()
        )

    if complete():
        return out

    url = (out.get("url") or "").strip()
    if not url:
        raise BrowserServiceError(
            "Browser agent needs a Page URL, or fill in Input, Send, and Response selectors manually."
        )

    logger.info("Selectors incomplete — running auto web probe (Discover) for %s", url)
    probe = await probe_page(url)

    if not probe.get("success"):
        err = probe.get("error", "probe failed")
        raise BrowserServiceError(
            f"Auto-discover failed: {err}. Click Discover in the UI or set selectors manually."
        )

    s = probe.get("suggested") or {}

    if not (out.get("input_selector") or "").strip() and (s.get("input_selector") or "").strip():
        out["input_selector"] = s["input_selector"]
    if not (out.get("send_selector") or "").strip():
        out["send_selector"] = (s.get("send_selector") or "").strip() or "Enter"
    if not (out.get("response_selector") or "").strip() and (s.get("response_selector") or "").strip():
        out["response_selector"] = s["response_selector"]
    if not (out.get("iframe_selector") or "").strip() and (s.get("iframe_selector") or "").strip():
        out["iframe_selector"] = s["iframe_selector"]

    if s.get("load_wait_ms") and not out.get("load_wait_ms"):
        out["load_wait_ms"] = s["load_wait_ms"]
    if s.get("wait_after_send_ms") and not out.get("wait_after_send_ms"):
        out["wait_after_send_ms"] = s["wait_after_send_ms"]

    if not complete():
        fc = probe.get("found_count", 0)
        raise BrowserServiceError(
            f"Auto-discover only found {fc}/3 selector types. "
            "Use Discover in the Connections page, pick selectors from the raw element list, "
            "save the agent, and try again."
        )

    logger.info(
        "Auto-filled selectors: input=%s send=%s response=%s iframe=%s",
        out.get("input_selector"),
        out.get("send_selector"),
        out.get("response_selector"),
        out.get("iframe_selector") or "(none)",
    )
    return out


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
