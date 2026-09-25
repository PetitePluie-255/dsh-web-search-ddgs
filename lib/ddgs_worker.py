#!/usr/bin/env python3
import json
import sys


def payload_error(code, message):
    print(json.dumps({"ok": False, "error": {"code": code, "message": message}}))


def main():
    try:
        request = json.loads(sys.stdin.read() or "{}")
    except Exception as exc:
        payload_error("invalid_arguments", f"invalid JSON request: {exc}")
        return 2

    try:
        from ddgs import DDGS
    except Exception as exc:
        payload_error(
            "provider_unavailable",
            "Python package 'ddgs' is not installed for this pythonBin. "
            "Install it with: python3 -m pip install ddgs",
        )
        return 3

    query = str(request.get("query", "")).strip()
    max_results = int(request.get("max_results", 5))
    backend = str(request.get("backend", "auto")).strip() or "auto"
    timeout = int(request.get("timeout_seconds", 20))

    if not query:
        payload_error("invalid_arguments", "web_search needs a non-empty query")
        return 2

    try:
        with DDGS(timeout=timeout) as client:
            rows = list(client.text(query, max_results=max_results, backend=backend))
    except Exception as exc:
        payload_error("provider_error", f"ddgs search failed: {exc}")
        return 4

    results = []
    for row in rows:
        results.append(
            {
                "title": row.get("title") or "",
                "url": row.get("href") or row.get("url") or "",
                "snippet": row.get("body") or row.get("snippet") or "",
            }
        )

    print(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
