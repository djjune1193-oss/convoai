"""
Tavily handles the actual web retrieval for the "what's happening today"
feature. This keeps that feature off Gemini's grounding-specific rate
limit entirely — Tavily has its own separate free quota (1,000
searches/month, no card), and the synthesis step afterward uses plain
(non-grounded) Gemini, the same cheap call type chat replies already use.
"""

import requests

from .config import settings

TAVILY_URL = "https://api.tavily.com/search"


def tavily_search(query: str, max_results: int = 5, time_range: str | None = "day") -> list[dict]:
    """
    time_range: "day" | "week" | "month" | "year" | None — biases results
    toward recent publish dates. Falls back to no filter if the caller
    passes None.
    """
    body = {
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
    }
    if time_range:
        body["time_range"] = time_range

    response = requests.post(
        TAVILY_URL,
        headers={
            "Authorization": f"Bearer {settings.TAVILY_API_KEY}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()

    return [
        {
            "title": r.get("title", "") or r.get("url", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
        }
        for r in data.get("results", [])
    ]
