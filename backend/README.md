# Swipe-to-Claude Chat — Backend

FastAPI + WebSocket backend. Serves the web frontend now, and will serve the
Swift and Android clients later without changes — they're all just HTTP/WS
clients of this same API.

Commands below are for **Windows (Command Prompt)**.

**AI providers:** Gemini powers swipe-to-AI chat replies and 📍 nearby-places
(Google Maps grounding). The 🌐 "what's happening today" feature uses
**Tavily** for the actual web search plus plain Gemini to write up the
answer — deliberately kept off Gemini's own Google Search grounding tool,
since that tool can silently fire multiple searches per question and was
causing frequent rate-limit errors on the free tier.

## Setup

```bat
cd backend
py -3.12 -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env
```
Open `.env` and paste your API keys in:
- `GEMINI_API_KEY` — free, no card, at aistudio.google.com/app/apikey
- `TAVILY_API_KEY` — free, no card, at tavily.com (1,000 searches/month)

> PowerShell: use `venv\Scripts\Activate.ps1` to activate instead.
> macOS/Linux: `python3 -m venv venv && source venv/bin/activate`, and
> `cp .env.example .env` instead of `copy`.

**Use Python 3.12.** Newer versions (3.13/3.14) can fail installing
`pydantic-core` because pre-built wheels may not exist for them yet, which
then tries (and fails without Visual Studio Build Tools) to compile it from
Rust source. Check installed versions with `py -0`; grab 3.12 from
python.org if needed.

## Run

```bat
uvicorn app.main:app --reload --port 8000
```

SQLite file `chatapp.db` is created automatically on first run. Swap
`DATABASE_URL` in `.env` for a Postgres URL when you're ready for production
(e.g. `postgresql://user:pass@localhost/chatapp`) — the SQLAlchemy models
don't change.

**Schema changes don't auto-migrate.** If you're upgrading from an earlier
version of this app, delete `chatapp.db` and let it regenerate — there's no
Alembic migration set up yet, so new columns/tables on an old file will
error rather than appear.

## How the pieces fit

- `POST /auth/signup` — `{username, password, display_name}` → creates the
  account and returns `{token, user}`. `username` is the chosen login ID /
  ConvoAI ID (lowercase-normalized, 3-20 chars).
- `POST /auth/login` — `{username, password}` → `{token, user}`
- `GET /auth/me` — `Authorization: Bearer <token>` → the current user, used
  to restore a session on app load
- `GET /users/{id}` — fetch a user
- `PATCH /users/{id}` — update profile fields (display_name, status, work,
  sports, hobbies) — all optional, only provided fields change
- `POST /users/{id}/avatar` — multipart file upload for a profile photo;
  serves back a URL under `/uploads/avatars/...`
- `GET /users/search?keyword=...&exclude_user_id=...` — matches on
  `hobbies`/`sports` substrings
- `GET /users/discover?user_id=...&keyword=...&offset=...&limit=...` —
  powers the 🔍 Discover page: every other user, ranked by shared
  hobby/sport/work word overlap with the viewer first (or by keyword match
  + same ranking if `keyword` is given); paginated via `offset`/`limit`
  (default 20, capped at 50)
- `POST /invites` — `{from_user_id, to_convoai_id}` — send a 1:1 invite by
  the recipient's ConvoAI ID; fails if that ID doesn't exist, is your own,
  or you already have a pending/accepted invite with them
- `GET /users/{id}/invites` — all invites involving this user, each tagged
  `direction: "incoming" | "outgoing"`
- `POST /invites/{id}/respond` — `{user_id, action: "accept"|"decline"}`
  (only the recipient can respond); accepting a 1:1 invite creates a new
  conversation, accepting a group invite (has `conversation_id` set) joins
  the existing one
- `POST /conversations` — create a conversation directly between user IDs
  (used internally by invite acceptance; not exposed in the current UI)
- `POST /conversations/group` — `{creator_id, name, convoai_ids: [...]}` —
  creates a group conversation and sends each listed ID an invite tied to it
- `POST /conversations/{id}/participants` — add a user to an existing
  conversation (kept for flexibility; not used by the current invite-only
  UI flow)
- `GET /users/{id}/conversations` — chat-list data for the home screen:
  every conversation this user is in, with a title and last-message preview
- `GET /conversations/{id}/messages` — message history (for initial load),
  includes resolved `sender_name`, `deleted` flag, and `liked_user_ids`
- `WS /ws/{conversation_id}` — live channel for a conversation. Event types
  in:
  - `{"type": "message", "sender_id": ..., "content": ..., "parent_message_id": null}` — normal chat message (parent_message_id set = it's a reply)
  - `{"type": "swipe_ai", "message_id": ...}` — swipe-to-AI, see below
  - `{"type": "find_nearby", "requester_id": ..., "query": ..., "lat": ..., "lng": ..., "address": ...}` — nearby-places search
  - `{"type": "web_search", "requester_id": ..., "query": ...}` — "what's happening today" search
  - `{"type": "toggle_like", "message_id": ..., "user_id": ...}` — like/unlike a message
  - `{"type": "delete_message", "message_id": ..., "requester_id": ...}` — soft-delete (only your own messages)
  - `{"type": "create_poll", "message_id": ..., "requester_id": ..., "question": ..., "options": [...]}` — converts your own text message into a poll in place
  - `{"type": "vote_poll", "message_id": ..., "user_id": ..., "option_id": ...}` — cast/change a vote (one active vote per poll per user)

  Event types out: `message` (new/AI message), `message_liked`,
  `message_deleted`, `message_updated` (poll created or voted on),
  `ai_typing` / `places_searching` (pending indicators), `ai_error`.

  On `swipe_ai`, the server fetches recent history, calls Gemini, and
  broadcasts the reply back down the same socket as a normal message with
  `sender_type: "ai"`.

**Gotcha to remember when adding new `/users/...` routes:** FastAPI matches
routes in registration order, and `/users/{user_id}` is a wildcard that
matches *any* literal path segment — including words like `search` or
`discover`. Any new literal route under `/users/` (e.g. `/users/something`)
must be registered **above** `/users/{user_id}` in `main.py`, or requests
to it silently get swallowed by `get_user()` and return a confusing
"User not found" instead of actually running. This has already caused one
real bug (`/users/search`) — both `/users/search` and `/users/discover`
are commented in the code explaining why their position matters.

## Identity & auth model

`POST /auth/signup` — user picks their own **User ID** (3-20 chars,
letters/numbers/underscore/hyphen, normalized to lowercase) and a password
(min 6 chars), plus a display name. Password is hashed with bcrypt; the
User ID doubles as the shareable "ConvoAI ID" used for invites and group
chat lookups.

`POST /auth/login` — verifies the User ID + password, returns a JWT session
token (`JWT_SECRET`/`JWT_EXPIRE_DAYS` in `.env`, default 30-day expiry).

`GET /auth/me` — `Authorization: Bearer <token>` header; used on app load
to restore a session instead of re-prompting login on every refresh/new
tab. Frontend stores the token in `localStorage`.

**Scope boundary, stated plainly:** this covers signup/login/session-restore
only. The rest of the API — every WebSocket event, most REST endpoints —
still trusts a client-supplied `user_id`/`sender_id`/`requester_id` directly
rather than re-verifying the JWT on every call. That's a real gap, not an
oversight: closing it means threading token verification through every
WebSocket handler and endpoint, which is a substantially bigger change than
"add login" and hasn't been done yet. Don't treat this as safe against a
malicious client impersonating another user's ID in a request body.

**Migration note:** `password_hash` is nullable in the schema specifically
so this could be added without breaking existing rows on a live database.
Any account created before this change has no password and **cannot log
in** — it has no way to set one retroactively without an explicit
"claim your old account" flow, which isn't built. Those accounts are
effectively orphaned; create a new one under a chosen User ID instead.

## Nearby places (Google Maps grounding via Gemini)

`find_nearby_places()` in `claude_service.py` uses Gemini's built-in Google
Maps grounding tool — no separate Places API key or Cloud billing account
needed, just `GEMINI_API_KEY`. Pass either
browser geolocation coordinates or a free-text address; results come back
as a JSON list (name, distance, rating, address) plus source citations,
stored as a `kind: "places"` message and rendered as a card in the UI.

Cost note: Maps grounding isn't unlimited. Gemini 3.x models get a shared
free monthly allowance of grounded queries (Search + Maps combined), then
bill per query beyond that — check the current rate on the
[Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing)
before relying on this at any real scale.

## "What's happening today" search (Tavily + Gemini)

`get_web_answer()` in `claude_service.py` no longer uses Gemini's Google
Search grounding tool — it was firing multiple internal searches per
question, each counted against Gemini's free-tier rate limit, and caused
frequent 429s. Instead:

1. `tavily_service.tavily_search()` does the actual web search — Tavily's
   own separate quota (1,000/month free, no card), filtered to `time_range:
   "day"` first (falls back to `"week"` if that comes up empty).
2. The top 5 results get handed to plain (non-grounded) Gemini
   `generate_content` — same cheap call type as `get_ai_reply()` — with a
   prompt anchored to today's actual server date, asking it to synthesize a
   concise answer from *only* those results.

This means 🌐 draws on two independent quotas (Tavily for search, Gemini
for a plain ungrounded call) instead of Gemini's rate-limited grounding
tool — the actual fix for the 429s, not just a mitigation.

**This is not a live-sports-scores feature.** Both Tavily's index and
Google's can lag an in-progress game by minutes. If you need genuinely
real-time game state, integrate a dedicated sports data API (API-SPORTS
has a generous free tier with WebSocket live feeds) as a separate feature
— it's a fundamentally different data source than web search.

## Chat replies

`get_ai_reply()` uses plain Gemini `generate_content` — no grounding tool,
just a system prompt plus the recent conversation history. Same
`GEMINI_MODEL` config as the other two features.

## Known shortcuts (fine for a prototype, fix before shipping)

- No auth — `sender_id` is trusted from the client. Add JWT/session auth
  before this touches real users.
- `get_ai_reply` is a blocking call inside the WebSocket handler. Fine at
  small scale; move to Gemini's async client + a background task queue
  once multiple swipes can happen concurrently.
- CORS defaults to `*` (wide open) via `ALLOWED_ORIGINS` in `.env` — fine
  for local dev, but set it to your actual domain(s) before deploying (see
  `deploy/DEPLOY.md`).
- Gemini model IDs get deprecated frequently — if you hit a 404 on the
  configured `GEMINI_MODEL`, check aistudio.google.com's model picker for
  a current free one and update `.env`.
