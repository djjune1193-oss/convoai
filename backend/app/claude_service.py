"""
- get_ai_reply(): swipe-to-AI chat replies, plain Gemini generate_content.
- find_nearby_places(): nearby-places search, via Gemini's Google Maps
  grounding tool.
- get_web_answer(): "what's happening today" search. Tavily does the actual
  web retrieval (separate free quota, no card, no Gemini rate-limit
  interaction), plain Gemini synthesizes the answer from those results.
  This one deliberately avoids Gemini's Google Search grounding tool —
  that tool can silently fire several searches per question, each counted
  against Gemini's free-tier rate limit, and was causing frequent 429s.

(File kept as claude_service.py so main.py's imports don't change — swap
the implementation here again if you switch providers later.)
"""

import json
import re
from datetime import date

from google import genai

from .config import settings
from .tavily_service import tavily_search

client = genai.Client(api_key=settings.GEMINI_API_KEY)

AI_DISPLAY_NAME = "Gemini"

SYSTEM_PROMPT = (
    "You are an AI assistant participating as a helpful third party inside a "
    "group or 1:1 chat conversation. You have been invoked because a "
    "participant swiped on a specific message to ask for your input. Respond "
    "concisely and naturally, like another participant in the thread — not "
    "like a customer support bot. If the swiped message is a question, "
    "answer it directly, but keep the rest of the conversation in mind for "
    "context."
)


def _format_history(history: list[dict]) -> str:
    return "\n".join(f"{m['sender_name']}: {m['content']}" for m in history)


def get_ai_reply(history: list[dict], swiped_message: dict) -> str:
    """
    history: oldest->newest list of {"sender_name": str, "content": str}
    swiped_message: the specific message the user swiped on
    """
    user_content = (
        f"Conversation so far:\n{_format_history(history)}\n\n"
        f"The message that was swiped for your input:\n"
        f"{swiped_message['sender_name']}: {swiped_message['content']}\n\n"
        "Reply as the next message in this thread."
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=user_content,
        config={
            "system_instruction": SYSTEM_PROMPT,
            "max_output_tokens": 500,
        },
    )

    return (response.text or "").strip()


def _extract_json_array(text: str) -> list:
    """Pull a JSON array out of a model response, tolerating markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"```$", "", cleaned).strip()
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if not match:
        raise ValueError("Gemini did not return a JSON array of places.")
    return json.loads(match.group(0))


def find_nearby_places(
    query: str,
    max_results: int = 10,
    lat: float | None = None,
    lng: float | None = None,
    address: str | None = None,
) -> dict:
    """
    Uses Gemini's built-in Google Maps grounding tool — no separate Places
    API key or billing account needed, just the existing GEMINI_API_KEY.

    Provide either (lat, lng) from browser geolocation, or a free-text
    address; at least one is required.
    """
    if lat is not None and lng is not None:
        location_phrase = "near my current location"
        tool = {"type": "google_maps", "latitude": lat, "longitude": lng}
    elif address:
        location_phrase = f"near {address}"
        tool = {"type": "google_maps"}
    else:
        raise ValueError("Provide either coordinates or an address.")

    prompt = (
        f"Using Google Maps data, find up to {max_results} places matching "
        f'"{query}" {location_phrase}. Respond with ONLY a JSON array (no '
        "other text, no markdown fences) where each item has exactly these "
        'fields: "name" (string), "distance_km" (number, your best estimate '
        'of straight-line distance from the reference location), "rating" '
        '(number from 1-5, or null if unknown), "address" (string, short '
        "formatted address). Sort the array by distance_km ascending."
    )

    interaction = client.interactions.create(
        model=settings.GEMINI_MODEL,
        input=prompt,
        tools=[tool],
    )

    raw_text = ""
    sources = []
    for step in interaction.steps:
        if step.type == "model_output":
            for block in step.content:
                if block.type == "text":
                    raw_text += block.text
                    for ann in (block.annotations or []):
                        if ann.type == "place_citation":
                            sources.append({"name": ann.name, "url": ann.url})

    places = _extract_json_array(raw_text)[:max_results]
    return {"results": places, "sources": sources}


def get_web_answer(query: str) -> dict:
    """
    "What's happening today" search: Tavily does the actual web retrieval
    (separate free quota, no card, unaffected by Gemini's rate limits),
    then plain (non-grounded) Gemini synthesizes a concise answer from the
    results — the same cheap, ungrounded call type get_ai_reply() uses.

    Falls back to a wider time range if same-day results come up empty.
    """
    results = tavily_search(query, max_results=5, time_range="day")
    if not results:
        results = tavily_search(query, max_results=5, time_range="week")
    if not results:
        raise ValueError(f"No web results found for: {query!r}")

    today_str = date.today().strftime("%A, %B %d, %Y")
    context = "\n\n".join(
        f"[{i + 1}] {r['title']}\n{r['content'][:600]}" for i, r in enumerate(results)
    )
    prompt = (
        f"Today's date is {today_str}. Using ONLY the search results below, "
        f"answer this question concisely (a few sentences to a short "
        f"paragraph): {query.strip()}\n\n"
        f"Search results:\n{context}\n\n"
        "If the results don't fully answer the question, say what's "
        "missing rather than guessing."
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config={"max_output_tokens": 400},
    )

    sources = [{"name": r["title"], "url": r["url"]} for r in results if r["url"]]
    return {"answer": (response.text or "").strip(), "sources": sources}
