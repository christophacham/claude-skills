#!/usr/bin/env python3
"""ddg-search CLI — free metasearch via the ddgs package (no API key).

Auto-installs `ddgs` into the current interpreter if missing.
Stdout: human-readable results (default) or JSON (--json).
Stderr: diagnostics / install progress.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from typing import Any


def ensure_ddgs() -> Any:
    """Import DDGS, installing the package if needed. Returns the DDGS class."""
    try:
        from ddgs import DDGS  # type: ignore

        return DDGS
    except ImportError:
        print(
            "ddgs not installed — running: python -m pip install -U ddgs",
            file=sys.stderr,
        )
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "-U", "ddgs"],
                stdout=sys.stderr,
            )
        except subprocess.CalledProcessError as e:
            print(
                f"Error: failed to install ddgs (exit {e.returncode}). "
                f"Install manually: {sys.executable} -m pip install -U ddgs",
                file=sys.stderr,
            )
            sys.exit(1)
        try:
            from ddgs import DDGS  # type: ignore

            return DDGS
        except ImportError:
            print(
                "Error: ddgs still not importable after install. "
                f"Interpreter: {sys.executable}",
                file=sys.stderr,
            )
            sys.exit(1)


def print_text_results(results: list[dict[str, Any]]) -> None:
    if not results:
        print("No results found.", file=sys.stderr)
        return
    for i, r in enumerate(results, 1):
        title = r.get("title") or ""
        link = r.get("href") or r.get("url") or ""
        body = r.get("body") or r.get("snippet") or ""
        print(f"--- Result {i} ---")
        print(f"Title: {title}")
        print(f"Link: {link}")
        if body:
            print(f"Snippet: {body}")
        print()


def print_news_results(results: list[dict[str, Any]]) -> None:
    if not results:
        print("No results found.", file=sys.stderr)
        return
    for i, r in enumerate(results, 1):
        print(f"--- Result {i} ---")
        print(f"Title: {r.get('title') or ''}")
        print(f"Link: {r.get('url') or r.get('href') or ''}")
        if r.get("date"):
            print(f"Date: {r['date']}")
        if r.get("source"):
            print(f"Source: {r['source']}")
        body = r.get("body") or ""
        if body:
            print(f"Snippet: {body}")
        print()


def _ddgs_call_errors():
    """Return (RatelimitException, TimeoutException, DDGSException, Exception)."""
    try:
        from ddgs.exceptions import (  # type: ignore
            DDGSException,
            RatelimitException,
            TimeoutException,
        )

        return RatelimitException, TimeoutException, DDGSException, Exception
    except ImportError:
        return Exception, Exception, Exception, Exception


def cmd_text(args: argparse.Namespace) -> int:
    DDGS = ensure_ddgs()
    Rate, Timeout, DDGSEx, _ = _ddgs_call_errors()
    kwargs: dict[str, Any] = {
        "region": args.region,
        "safesearch": args.safesearch,
        "max_results": args.max_results,
        "page": args.page,
        "backend": args.backend,
    }
    if args.timelimit:
        kwargs["timelimit"] = args.timelimit
    try:
        results = DDGS(proxy=args.proxy, timeout=args.timeout).text(
            query=args.query, **kwargs
        )
    except Rate as e:
        print(f"Error: rate limited: {e}", file=sys.stderr)
        print("Hint: wait, set --proxy, or try -b bing,brave", file=sys.stderr)
        return 1
    except Timeout as e:
        print(f"Error: timeout: {e}", file=sys.stderr)
        print("Hint: raise --timeout or simplify the query", file=sys.stderr)
        return 1
    except DDGSEx as e:
        print(f"Error: text search failed: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: text search failed: {e}", file=sys.stderr)
        return 1
    results = list(results or [])
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print_text_results(results)
    return 0


def cmd_news(args: argparse.Namespace) -> int:
    DDGS = ensure_ddgs()
    Rate, Timeout, DDGSEx, _ = _ddgs_call_errors()
    kwargs: dict[str, Any] = {
        "region": args.region,
        "safesearch": args.safesearch,
        "max_results": args.max_results,
        "page": args.page,
        "backend": args.backend,
    }
    if args.timelimit:
        kwargs["timelimit"] = args.timelimit
    try:
        results = DDGS(proxy=args.proxy, timeout=args.timeout).news(
            query=args.query, **kwargs
        )
    except Rate as e:
        print(f"Error: rate limited: {e}", file=sys.stderr)
        return 1
    except Timeout as e:
        print(f"Error: timeout: {e}", file=sys.stderr)
        return 1
    except DDGSEx as e:
        print(f"Error: news search failed: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: news search failed: {e}", file=sys.stderr)
        return 1
    results = list(results or [])
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print_news_results(results)
    return 0


def cmd_extract(args: argparse.Namespace) -> int:
    DDGS = ensure_ddgs()
    try:
        result = DDGS(proxy=args.proxy, timeout=args.timeout).extract(
            args.url, fmt=args.format
        )
    except Exception as e:
        print(f"Error: extract failed: {e}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if isinstance(result, dict):
        url = result.get("url") or args.url
        content = result.get("content") or ""
        print(f"URL: {url}")
        print(f"Content:\n{content}")
    else:
        print(result)
    return 0


def cmd_check(_: argparse.Namespace) -> int:
    """Report interpreter + whether ddgs is importable (no install)."""
    print(f"python: {sys.executable}")
    print(f"version: {sys.version.split()[0]}")
    try:
        import ddgs  # type: ignore

        ver = getattr(ddgs, "__version__", "unknown")
        print(f"ddgs: installed ({ver})")
        return 0
    except ImportError:
        print("ddgs: MISSING (search will auto-install on first use)")
        return 2


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="search.py",
        description="Free web search via ddgs (no API key). Auto-installs ddgs if missing.",
    )
    p.add_argument(
        "--proxy",
        default=None,
        help="Proxy URL, e.g. socks5h://127.0.0.1:9150",
    )
    p.add_argument(
        "--timeout",
        type=int,
        default=15,
        help="HTTP timeout seconds (default: 15)",
    )
    p.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON instead of human-readable blocks",
    )

    sub = p.add_subparsers(dest="command", required=True)

    check = sub.add_parser("check", help="Report python + ddgs install status")
    check.set_defaults(func=cmd_check)

    def add_search_flags(sp: argparse.ArgumentParser, backends_help: str) -> None:
        sp.add_argument("query", help="Search query")
        sp.add_argument(
            "-n",
            "--max-results",
            type=int,
            default=5,
            dest="max_results",
            help="Number of results (default: 5)",
        )
        sp.add_argument(
            "-r",
            "--region",
            default="us-en",
            help="Region code (default: us-en)",
        )
        sp.add_argument(
            "-s",
            "--safesearch",
            choices=["on", "moderate", "off"],
            default="moderate",
            help="SafeSearch (default: moderate)",
        )
        sp.add_argument(
            "-t",
            "--timelimit",
            choices=["d", "w", "m", "y"],
            default=None,
            help="Time filter: d/w/m/y",
        )
        sp.add_argument(
            "-p",
            "--page",
            type=int,
            default=1,
            help="Page number (default: 1)",
        )
        sp.add_argument(
            "-b",
            "--backend",
            default="auto",
            help=backends_help,
        )

    text = sub.add_parser("text", help="Web text metasearch")
    add_search_flags(
        text,
        "Backend: auto|all|bing|brave|duckduckgo|google|… (default: auto)",
    )
    text.set_defaults(func=cmd_text)

    news = sub.add_parser("news", help="News metasearch")
    add_search_flags(
        news,
        "Backend: auto|all|bing|duckduckgo|yahoo (default: auto)",
    )
    news.set_defaults(func=cmd_news)

    extract = sub.add_parser("extract", help="Fetch URL and extract content")
    extract.add_argument("url", help="URL to extract")
    extract.add_argument(
        "-f",
        "--format",
        choices=["text_markdown", "text_plain", "text_rich", "text", "content"],
        default="text_markdown",
        help="Extract format (default: text_markdown)",
    )
    extract.set_defaults(func=cmd_extract)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
