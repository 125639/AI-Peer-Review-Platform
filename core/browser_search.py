"""Browser-assisted web search utilities.

This module lets AI models trigger real headless-browser fetches so the
application can gather up-to-date information beyond pure API calls.
"""
from __future__ import annotations

import importlib
from importlib import util as importlib_util
from typing import Any, Dict, List, Optional, cast

from core.config import get_config
from core.logging import get_logger
from core.searxng import SearXNGClient, get_searxng_client

logger = get_logger(__name__)

_playwright_spec = importlib_util.find_spec("playwright.async_api")

if _playwright_spec is not None:
    _playwright_module = importlib.import_module("playwright.async_api")
    async_playwright = _playwright_module.async_playwright  # type: ignore[attr-defined]
    PlaywrightError = _playwright_module.Error  # type: ignore[attr-defined]
    PlaywrightTimeoutError = _playwright_module.TimeoutError  # type: ignore[attr-defined]
    _playwright_available = True
else:  # pragma: no cover - handled gracefully at runtime
    async_playwright = None  # type: ignore[assignment]
    PlaywrightError = Exception  # type: ignore[assignment]
    PlaywrightTimeoutError = Exception  # type: ignore[assignment]
    _playwright_available = False


class BrowserSearchUnavailable(RuntimeError):
    """Raised when the browser-based search capability cannot be used."""


class BrowserSearchClient:
    """Client that orchestrates API search plus browser scraping."""

    def __init__(self) -> None:
        cfg = get_config().browser
        self.enabled: bool = cfg.enabled
        self.max_pages: int = max(1, cfg.max_pages)
        self.max_chars: int = max(200, cfg.max_chars)
        self.timeout_ms: int = max(5000, cfg.timeout_ms)
        self.user_agent: Optional[str] = cfg.user_agent

    async def search(self, query: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
        """Execute a browser-backed search workflow."""
        if not self.enabled:
            raise BrowserSearchUnavailable("Browser search has been disabled in configuration.")
        if not _playwright_available:
            raise BrowserSearchUnavailable(
                "Playwright is not installed. Please install it via 'pip install playwright' and 'playwright install chromium'."
            )
        if not query or not query.strip():
            return {"success": False, "error": "搜索关键词不能为空", "pages": []}

        normalized_query = query.strip()
        searx_client: SearXNGClient = get_searxng_client()
        searx_results: Dict[str, Any] = await self._searx_search(searx_client, normalized_query)
        if not searx_results.get("success"):
            return {
                "success": False,
                "error": searx_results.get("error", "搜索失败"),
                "pages": [],
            }

        raw_results: List[Dict[str, Any]] = searx_results.get("results", [])
        usable_results: List[Dict[str, Any]] = [item for item in raw_results if item.get("url")]
        if not usable_results:
            return {
                "success": False,
                "error": "未找到可访问的搜索结果链接",
                "pages": [],
            }

        target_count = max(1, min(max_pages or self.max_pages, len(usable_results)))
        target_results: List[Dict[str, Any]] = usable_results[:target_count]
        urls: List[str] = [item["url"] for item in target_results]

        page_snapshots: List[Dict[str, Any]] = await self._snapshot_pages(urls)

        enriched_pages: List[Dict[str, Any]] = []
        context_segments: List[str] = []

        for idx, (base, snapshot) in enumerate(zip(target_results, page_snapshots), start=1):
            merged: Dict[str, Any] = {**base, **snapshot}
            snippet = merged.get("snippet") or base.get("content", "")
            title = merged.get("title") or base.get("title") or merged.get("url")
            context_segments.append(
                f"{idx}. {title}\nURL: {merged.get('url')}\n摘要: {snippet}\n"
            )
            enriched_pages.append(merged)

        return {
            "success": True,
            "query": normalized_query,
            "pages": enriched_pages,
            "context": "\n".join(context_segments).strip(),
            "raw": searx_results,
        }

    async def _snapshot_pages(self, urls: List[str]) -> List[Dict[str, Any]]:
        if not _playwright_available or async_playwright is None:
            raise BrowserSearchUnavailable(
                "Playwright runtime is unavailable. Install it via 'pip install playwright' and 'playwright install chromium'."
            )

        snapshots: List[Dict[str, Any]] = []
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context_kwargs = {}
                if self.user_agent:
                    context_kwargs["user_agent"] = self.user_agent
                context = await browser.new_context(**context_kwargs)

                for url in urls:
                    page_data: Dict[str, Any] = {"url": url}
                    page = await context.new_page()
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
                        page_data["title"] = (await page.title()) or url
                        try:
                            body_text = await page.inner_text("body")
                        except PlaywrightError:
                            body_text = await page.content()
                        page_data["snippet"] = self._trim_text(body_text)
                    except PlaywrightTimeoutError:
                        page_data["error"] = "timeout"
                        logger.warning("Browser search timeout when visiting %s", url)
                    except PlaywrightError as exc:
                        page_data["error"] = str(exc)
                        logger.warning("Browser search failed for %s: %s", url, exc)
                    except Exception as exc:  # pragma: no cover - defensive
                        page_data["error"] = str(exc)
                        logger.exception("Unexpected browser search error for %s", url)
                    finally:
                        await page.close()
                    snapshots.append(page_data)

                await context.close()
                await browser.close()
        except PlaywrightError as exc:
            logger.error("Playwright failed to start: %s", exc)
            raise BrowserSearchUnavailable(str(exc)) from exc
        return snapshots

    def _trim_text(self, raw: str) -> str:
        collapsed = " ".join(raw.split())
        return collapsed[: self.max_chars]

    async def _searx_search(self, client: SearXNGClient, query: str) -> Dict[str, Any]:
        """Wrapper that provides stable typing over the SearXNG client."""
        result = await client.search(query)  # type: ignore
        return cast(Dict[str, Any], result)


def is_browser_available() -> bool:
    """Return True if browser search can be used."""
    if not _playwright_available:
        return False
    return get_config().browser.enabled


_browser_client: Optional[BrowserSearchClient] = None


def get_browser_search_client() -> BrowserSearchClient:
    """Return a cached BrowserSearchClient instance."""
    global _browser_client
    if _browser_client is None:
        _browser_client = BrowserSearchClient()
    return _browser_client


__all__ = [
    "BrowserSearchClient",
    "BrowserSearchUnavailable",
    "get_browser_search_client",
    "is_browser_available",
]
