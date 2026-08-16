# ConvoAI — Step 1 (Web)

A working end-to-end prototype: FastAPI + WebSocket backend, React (Vite)
frontend. Each person gets a unique **ConvoAI ID** and a profile (photo,
status, optional work/sports/hobbies). You can only chat with someone after
they accept your invite — sent by entering their ConvoAI ID. Inside a chat:
swipe a message left for an inline **Gemini** reply, tap 📍 for nearby
places (Gemini's Google Maps grounding) or 🌐 for "what's happening today"
(**Tavily** search + Gemini synthesis — kept off Gemini's own search tool
to avoid its rate limit), and use the **⋯** menu on any message to like,
reply, turn it into a poll, or delete it.

**Note on identity:** this uses a system-generated unique ID instead of
email/password login for now — there's no persistent session, so refreshing
or reopening the app in a new browser creates a new account. Full
email+password authentication with real sessions is planned for a later
pass; treat this as the identity layer it's built on top of.

Commands below are for **Windows (Command Prompt)**. If you're using
PowerShell or macOS/Linux, see the notes after each block.

## Prerequisites

- **Python 3.12** — newer versions (3.13/3.14) may fail to install
  dependencies because some packages don't have pre-built wheels yet.
  Check what you have with `py -0`; install 3.12 from
  [python.org](https://www.python.org/downloads/release/python-3120/) if
  it's not listed, and check "Add python.exe to PATH" during install.
- **Node.js (LTS)** — from [nodejs.org](https://nodejs.org). Installing
  Node also installs `npm`. Restart your terminal after installing so the
  updated PATH takes effect.
- A free **Gemini API key** — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey),
  no credit card needed. Powers swipe-to-AI replies, nearby places, and
  answer synthesis for the 🌐 feature.
- A free **Tavily API key** — [tavily.com](https://tavily.com), no credit
  card needed. Powers the actual web search behind the 🌐 "what's
  happening today" feature (1,000 searches/month free).

> **If you've run this app before:** delete `backend/chatapp.db` before
> starting the backend this time. The database schema changed again (new
> profile fields, invites table) and SQLite doesn't auto-migrate — the old
> file will cause errors until it's removed and recreated fresh.

## Run it

**Terminal 1 — backend**
```bat
cd backend
py -3.12 -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env
```
Now open `.env` in a text editor and paste your key into
`GEMINI_API_KEY=`. Then:
```bat
uvicorn app.main:app --reload --port 8000
```
Leave this terminal running. You should see `Application startup complete`.

> PowerShell users: activate with `venv\Scripts\Activate.ps1` instead of
> `.bat`. If that's blocked, run
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first.
>
> macOS/Linux: `python3 -m venv venv && source venv/bin/activate`, and
> `cp .env.example .env` instead of `copy`.

**Terminal 2 — frontend**
```bat
cd frontend
npm install
npm run dev
```
Leave this running too — it'll print a local URL, usually
`http://localhost:5173`.

## Try it

1. Open `http://localhost:5173` in two different windows (e.g. a normal
   window and an incognito one) to act as two people, "Alice" and "Bob."
2. **Alice:** enter a name, click **Get started**. You'll land on the
   **profile setup** screen — add a photo, a status, and optionally
   work/sports/hobbies, then **Continue to ConvoAI**. Note the **ConvoAI
   ID** shown on this page (e.g. `K7M2QXR`) — that's what people use to
   invite you.
3. **Bob:** same thing in the other window, note his ConvoAI ID too.
4. **Alice:** on the home screen, tap **+**, enter Bob's ConvoAI ID, **Send
   invite**.
5. **Bob:** tap the **🔔** button (it'll show a badge), see Alice's invite
   under "For you," tap **Accept**. This drops Bob straight into the new
   chat.
6. **Alice:** her chat list now shows the conversation too — open it.
7. Send messages back and forth. **Click-and-drag a message left** past
   the "🤖 Ask AI" hint for an inline reply from **Gemini**. Tap **📍** for
   nearby places, or **🌐** for a today-dated answer to something like
   "what's going on in [your city] today" — this one searches via
   **Tavily** and has Gemini write up the answer, on a completely separate
   quota from the other two features. Tap **⋯** on any message for Reply /
   Make a poll / Delete, and **❤** to like.

   Note on 🌐: it's genuinely good for local news/events and general
   "what's current" questions, but **not reliable for live sports scores**
   — Google Search grounding can lag behind an in-progress game. A live
   score feature would need a dedicated sports data API (e.g. API-SPORTS),
   which isn't built here yet.
8. Tap your own avatar/name at the top of the home screen any time to
   revisit and edit your profile — clicking your photo there opens it
   full-screen with your status overlaid at the bottom.

## Troubleshooting

- **`pydantic-core` fails to build / asks for a Rust/MSVC linker** — you're
  on Python 3.13+. Rebuild the venv with `py -3.12` as shown above.
- **`'npm' is not recognized`** — Node isn't installed, or you didn't
  restart your terminal after installing it.
- **Stuck on "Gemini is thinking…"** — check the backend terminal for a
  stack trace. Most common cause: an expired/invalid model name in
  `GEMINI_MODEL` (Google retires model IDs often — check
  [aistudio.google.com](https://aistudio.google.com)'s model picker for a
  current free one) or a missing/wrong `GEMINI_API_KEY`.
- **404 on a Gemini model name** — that model was deprecated. Update
  `GEMINI_MODEL` in `.env` to whatever's currently listed as free in AI
  Studio, then restart uvicorn — this affects all three AI features since
  they now share one model config.
- **📍 nearby-places search fails or errors immediately** — you likely have
  an older `google-genai` installed. Maps grounding needs SDK 2.0.0+; run
  `pip install --upgrade google-genai` in your activated venv and restart
  uvicorn.
- **"429 too many requests" on chat replies or nearby places** — Gemini's
  free tier is roughly 15 requests/minute and ~1,000-1,500/day on
  `gemini-3.5-flash-lite`. Wait ~60 seconds and retry; if it persists
  immediately, you've hit the daily cap (resets at midnight Pacific) or
  need to enable billing on the Google Cloud project for higher limits.
  The 🌐 web-search feature no longer shares this limit (see below).
- **Errors specifically on 🌐 web search** — check `TAVILY_API_KEY` is set
  in `.env`; Tavily's free tier is 1,000 searches/month, separate from
  Gemini's quota entirely.
- **Browser doesn't ask for location permission / "Use my location" fails**
  — geolocation requires either `localhost` (fine for local dev) or HTTPS;
  it silently won't work over a plain HTTP LAN address. Use "Type an
  address" instead in that case.
- **Errors right after starting the backend / weird 500s on message
  actions** — you're probably running against an old `chatapp.db` from
  before likes/polls/delete were added. Stop uvicorn, delete
  `backend/chatapp.db`, restart.
- **Home screen stuck on "Loading your chats…"** — check the backend
  terminal; this calls `GET /users/{id}/conversations`, so a stack trace
  there usually points at the stale-database issue above.
- **"No one has that ConvoAI ID"** — IDs are case-sensitive-generated but
  compared uppercase; make sure you copied it exactly, no extra spaces.
- **Photo upload fails** — make sure `python-multipart` installed (it's in
  `requirements.txt`); this is required for FastAPI to parse file uploads
  and is easy to miss if you only partially re-ran `pip install`.
- **Refreshing the page logs you out / creates a new account** — expected
  for now. There's no persistent session yet (see the identity note above)
  — that's the next piece of work, not a bug.

## Deployment

Ready to put this on a real server? See [`deploy/DEPLOY.md`](deploy/DEPLOY.md)
for a full walkthrough — systemd service, Nginx reverse proxy, HTTPS via
certbot, and a deploy script that pulls from your own GitHub repo and
restarts everything (`git push`, then `ssh ... deploy/deploy.sh`). No
dedicated deploy user — it runs as whatever account you SSH in with.

The codebase is already deploy-ready: the frontend uses relative `/api` and
`/ws` paths (no hardcoded `localhost`), and the backend's CORS origins are
configurable via `ALLOWED_ORIGINS` in `.env` instead of wide open.

## What's here vs. what's next

This is Step 1: unique-ID identity, profiles, an invite-gated connection
model, multi-conversation navigation, the core AI mechanic (swipe → reply),
location-aware nearby-places search, and per-message actions (like, reply,
poll, delete) — all working end to end. Deliberately not yet built:

- **Real authentication** — email/password with hashing and persistent
  sessions (JWT or server sessions). Today's unique-ID system is a
  stand-in; nothing survives a page refresh in a new browser tab.
- **Group invites** — the backend's invite flow creates 1:1 conversations
  only; inviting multiple people into one group chat isn't wired up yet.
- **Interest matching** — work/sports/hobbies fields are captured and
  stored but nothing uses them yet; that's the "connect people with similar
  interests nearby" system mentioned as a future goal.
- **Persistence of "who can see AI replies / poll results"** — right now
  everything is visible to every participant.
- **Precise place data** — nearby-places uses Gemini's Maps grounding,
  which estimates distance/rating from grounded data rather than querying
  a Places API database directly.
- **Live sports scores** — the 🌐 feature is Google Search grounding, which
  is good for local news/events but not for in-progress game state (results
  can lag). A real live-scores feature needs a dedicated sports data API
  (e.g. API-SPORTS) — not built yet.
- **Read receipts, typing indicators for other users**
- **iOS (Swift) client** — same backend, SwiftUI + URLSessionWebSocketTask
- **Android client** — same backend, Jetpack Compose + OkHttp WebSocket

Once you're happy with the web mechanic, the natural next step is porting
just the swipe gesture + WebSocket client to Swift, reusing this exact
backend and event protocol (`message` / `swipe_ai` / `find_nearby` /
`toggle_like` / `delete_message` / `create_poll` / `vote_poll` /
`ai_typing` / `places_searching` / `message_liked` / `message_deleted` /
`message_updated` / `ai_error`).
