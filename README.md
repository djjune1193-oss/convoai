# ConvoAI — Step 1 (Web)

A working end-to-end prototype: FastAPI + WebSocket backend, React (Vite)
frontend. Sign up with a **User ID and password you choose** — that ID
doubles as your shareable **ConvoAI ID**. Log back in anytime with the same
credentials; sessions persist across refreshes and new tabs. Add a profile
(photo, status, optional work/sports/hobbies). You can only chat with
someone after they accept your invite — sent by entering their ConvoAI ID,
or find people by shared interest via 🔍 search. Inside a chat: swipe a
message left for an inline **Gemini** reply, tap 📍 for nearby places
(Gemini's Google Maps grounding) or 🌐 for "what's happening today"
(**Tavily** search + Gemini synthesis — kept off Gemini's own search tool
to avoid its rate limit), and use the **⋯** menu on any message to like,
reply, turn it into a poll, or delete it.

**Note on auth scope:** login/signup/sessions are real (bcrypt-hashed
passwords, JWT tokens). What's *not* yet built: the rest of the API doesn't
re-verify that token on every request — it still trusts a client-supplied
user ID directly on most calls. See `deploy/DEPLOY.md`'s auth section, or
`backend/README.md`, for the exact boundary.

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
2. **Alice:** on the **Sign up** tab, pick a User ID (e.g. `alice1`), a
   password, and enter a display name, then **Create account**. That User
   ID *is* her ConvoAI ID — remember it, since she'll log back in with it.
   You'll land on **profile setup** — add a photo, a status, and optionally
   work/sports/hobbies, then **Continue to ConvoAI**.
3. **Bob:** same thing in the other window, his own User ID/password.
4. **Alice:** on the home screen, tap **👤➕ Invite**, enter Bob's ConvoAI
   ID, **Send invite**. (The **👥 Group** button does the same thing for
   multiple people at once; **🔍 Search** opens a full **Discover** page —
   a scrollable photo-tile grid of everyone on ConvoAI, ranked by shared
   hobbies/sports/work with you by default, with its own search box to
   filter by keyword instead. **Connect** on any tile sends the same kind
   of invite as the 👤➕ button.)
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
   — search results can lag behind an in-progress game. A live score
   feature would need a dedicated sports data API (e.g. API-SPORTS), which
   isn't built here yet.
8. Tap your own avatar/name at the top of the home screen any time to
   revisit and edit your profile — clicking your photo there opens it
   full-screen with your status overlaid at the bottom. A **Log out**
   button is at the bottom of that screen.
9. Close the tab and reopen `http://localhost:5173` — you should land
   straight on your chat list, not the welcome screen. That's the actual
   point of this update: the session persists now.

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
- **"No one has that ConvoAI ID"** — IDs are lowercase-normalized on both
  ends, so casing shouldn't matter, but check for extra spaces or a typo.
- **"Incorrect user ID or password"** — same message whether the ID
  doesn't exist or the password's wrong (deliberate, so a failed login
  doesn't reveal which valid IDs exist). Double-check both.
- **Signed up before this update, now can't log in** — accounts created
  under the old auto-generated-ID system have no password on file and
  can't log in under the new system. Sign up fresh under a User ID you
  choose.
- **Logged out unexpectedly after ~30 days** — sessions expire per
  `JWT_EXPIRE_DAYS` in `.env` (default 30). Just log back in; adjust that
  value if you want a longer/shorter session lifetime.
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

This is Step 1: real login (bcrypt + JWT sessions), profiles, an
invite-gated connection model (1:1 and group), multi-conversation
navigation, the core AI mechanic (swipe → reply), location-aware
nearby-places search, keyword people search by hobby/sport, and
per-message actions (like, reply, poll, delete) — all working end to end,
responsive from phone to desktop. Deliberately not yet built:

- **Full request-level auth** — login/signup/sessions are real, but the
  rest of the API still trusts a client-supplied user ID directly on most
  calls instead of re-verifying the JWT every time. See `backend/README.md`'s
  auth section for the exact boundary — closing this fully means touching
  every WebSocket handler and endpoint, not just the login flow.
- **Account recovery** — no "forgot password" flow; losing your password
  means losing access to that account (there's no email on file to reset
  via).
- **Discover page ranking is keyword-overlap only** — 🔍 now opens a full
  "Discover" page (photo tiles, scrollable, "Load more") instead of a
  small modal. Default order ranks by shared hobby/sport/work word overlap
  with your own profile; there's no weighting by recency of activity,
  mutual connections, or anything beyond simple word matching yet.
- **Persistence of "who can see AI replies / poll results"** — right now
  everything is visible to every participant.
- **Precise place data** — nearby-places uses Gemini's Maps grounding,
  which estimates distance/rating from grounded data rather than querying
  a Places API database directly.
- **Live sports scores** — the 🌐 feature is Tavily + Gemini synthesis,
  good for local news/events but not for in-progress game state (results
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
