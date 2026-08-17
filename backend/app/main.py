import json
import os
import re
import uuid
from math import atan2, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import auth_service, models, schemas
from .claude_service import AI_DISPLAY_NAME, find_nearby_places, get_ai_reply, get_web_answer
from .config import settings
from .database import Base, engine, get_db
from .websocket_manager import manager


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in kilometers."""
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def _interest_tokens(user: "models.User") -> set:
    """Lowercased word tokens from a user's hobbies/sports/work fields, used
    to rank Discover results by shared-interest overlap with the viewer."""
    words: set = set()
    for text in (user.hobbies, user.sports, user.work):
        if not text:
            continue
        for w in re.split(r"[,\s]+", text.lower()):
            w = w.strip()
            if len(w) > 1:
                words.add(w)
    return words


def _friendly_gemini_error(exc: Exception) -> str:
    """Turn raw Gemini API errors into something worth showing a user —
    rate limits especially, since those are common on the free tier and
    the raw error is an unreadable JSON blob."""
    text = str(exc)
    if "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
        return (
            "Gemini's free-tier rate limit was hit (too many requests in a "
            "short time, or the daily cap). Wait about a minute and try "
            "again — if it persists, the daily quota may be exhausted until "
            "it resets at midnight Pacific time."
        )
    return text

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

app = FastAPI(title="ConvoAI Chat API")
router = APIRouter()  # all REST endpoints below live under /api — see include_router at bottom of file

_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,  # set ALLOWED_ORIGINS in .env for production, e.g. https://yourdomain.com
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ---------------------------------------------------------------------------
# Auth: signup, login, session restore
# ---------------------------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/auth/signup", response_model=schemas.AuthResponse)
def signup(payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    try:
        username = auth_service.validate_username(payload.username)
        auth_service.validate_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not payload.display_name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    if db.query(models.User).filter_by(username=username).first():
        raise HTTPException(status_code=400, detail="That user ID is already taken")

    user = models.User(
        username=username,
        password_hash=auth_service.hash_password(payload.password),
        display_name=payload.display_name.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return schemas.AuthResponse(token=auth_service.create_token(user.id), user=user)


@router.post("/auth/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    user = db.query(models.User).filter_by(username=username).first()

    if not user or not user.password_hash or not auth_service.verify_password(payload.password, user.password_hash):
        # Same message whether the username doesn't exist or the password is
        # wrong — don't reveal which one to a caller probing for valid IDs.
        raise HTTPException(status_code=401, detail="Incorrect user ID or password")

    return schemas.AuthResponse(token=auth_service.create_token(user.id), user=user)


@router.get("/auth/me", response_model=schemas.UserOut)
def get_me(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: Session = Depends(get_db)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = auth_service.decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


# ---------------------------------------------------------------------------
# REST: users & profiles
# ---------------------------------------------------------------------------

# IMPORTANT: this must stay registered BEFORE /users/{user_id} below.
# FastAPI/Starlette match routes in registration order, and {user_id} is a
# wildcard that matches literally anything — including the string "search".
# If this moves below /users/{user_id} again, every request to
# /users/search gets swallowed by get_user(user_id="search") instead,
# which is exactly the bug that caused search to always return 404.
@router.get("/users/search", response_model=list[schemas.UserSearchResult])
def search_users(keyword: str, exclude_user_id: str = None, db: Session = Depends(get_db)):
    kw = keyword.strip()
    if not kw:
        return []
    pattern = f"%{kw}%"
    query = db.query(models.User).filter(
        models.User.hobbies.ilike(pattern) | models.User.sports.ilike(pattern)
    )
    if exclude_user_id:
        query = query.filter(models.User.id != exclude_user_id)
    return query.limit(30).all()


# Same routing-order caution as /users/search above — must stay registered
# before /users/{user_id}.
@router.get("/users/discover", response_model=list[schemas.UserSearchResult])
def discover_users(
    user_id: str,
    keyword: str = None,
    offset: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    Browse other ConvoAI users, ranked by shared interests with the viewer
    first (overlap between hobbies/sports/work token sets), with distance
    from the viewer as a tiebreaker when both have shared their location.
    If `keyword` is given, filters to hobby/sport matches first (same logic
    as /users/search) and then applies the same ranking within those
    results.
    """
    limit = max(1, min(limit, 50))

    viewer = db.query(models.User).get(user_id)
    viewer_tokens = _interest_tokens(viewer) if viewer else set()
    viewer_has_location = bool(viewer and viewer.latitude is not None and viewer.longitude is not None)

    query = db.query(models.User).filter(models.User.id != user_id)
    kw = (keyword or "").strip()
    if kw:
        pattern = f"%{kw}%"
        query = query.filter(
            models.User.hobbies.ilike(pattern) | models.User.sports.ilike(pattern)
        )

    candidates = query.all()

    # Attach a transient (non-persisted) distance_km attribute to each ORM
    # object — UserSearchResult picks it up via from_attributes, and raw
    # coordinates never leave the server.
    for u in candidates:
        if viewer_has_location and u.latitude is not None and u.longitude is not None:
            u.distance_km = round(_distance_km(viewer.latitude, viewer.longitude, u.latitude, u.longitude), 1)
        else:
            u.distance_km = None

    candidates.sort(
        key=lambda u: (
            -len(viewer_tokens & _interest_tokens(u)),
            u.distance_km if u.distance_km is not None else float("inf"),
            -(u.created_at.timestamp() if u.created_at else 0),
        )
    )
    return candidates[offset:offset + limit]


@router.post("/users/{user_id}/location", response_model=schemas.UserOut)
def update_location(user_id: str, payload: schemas.LocationUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.latitude = payload.latitude
    user.longitude = payload.longitude
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=schemas.UserOut)
def update_profile(user_id: str, payload: schemas.ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.display_name is not None:
        if not payload.display_name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        user.display_name = payload.display_name.strip()
    if payload.status is not None:
        user.status = payload.status.strip() or None
    if payload.work is not None:
        user.work = payload.work.strip() or None
    if payload.sports is not None:
        user.sports = payload.sports.strip() or None
    if payload.hobbies is not None:
        user.hobbies = payload.hobbies.strip() or None

    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/avatar", response_model=schemas.UserOut)
def upload_avatar(user_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(AVATAR_DIR, filename)
    with open(dest_path, "wb") as f:
        f.write(file.file.read())

    user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# REST: invites
# ---------------------------------------------------------------------------

@router.post("/invites", response_model=schemas.InviteOut)
def send_invite(payload: schemas.InviteCreate, db: Session = Depends(get_db)):
    from_user = db.query(models.User).get(payload.from_user_id)
    if not from_user:
        raise HTTPException(status_code=404, detail="Your account was not found")

    to_user = db.query(models.User).filter_by(username=payload.to_convoai_id.strip().lower()).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="No one has that ConvoAI ID")
    if to_user.id == from_user.id:
        raise HTTPException(status_code=400, detail="You can't invite yourself")

    # Only dedup against other 1:1 invites (conversation_id IS NULL) — group
    # invites (tied to a specific conversation) are handled separately in
    # create_group_chat() and shouldn't block a normal 1:1 invite.
    existing = (
        db.query(models.Invite)
        .filter(
            models.Invite.conversation_id.is_(None),
            models.Invite.status != models.InviteStatus.declined,
            (
                ((models.Invite.from_user_id == from_user.id) & (models.Invite.to_user_id == to_user.id))
                | ((models.Invite.from_user_id == to_user.id) & (models.Invite.to_user_id == from_user.id))
            ),
        )
        .first()
    )
    if existing:
        detail = "You're already connected" if existing.status == models.InviteStatus.accepted else "An invite is already pending"
        raise HTTPException(status_code=400, detail=detail)

    invite = models.Invite(from_user_id=from_user.id, to_user_id=to_user.id)
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return schemas.InviteOut(
        id=invite.id,
        status=invite.status.value,
        direction="outgoing",
        from_user=from_user,
        to_user=to_user,
        conversation_id=None,
        created_at=invite.created_at,
    )


@router.get("/users/{user_id}/invites", response_model=list[schemas.InviteOut])
def list_invites(user_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Invite)
        .filter(
            (models.Invite.from_user_id == user_id) | (models.Invite.to_user_id == user_id)
        )
        .order_by(models.Invite.created_at.desc())
        .all()
    )
    return [
        schemas.InviteOut(
            id=inv.id,
            status=inv.status.value,
            direction="incoming" if inv.to_user_id == user_id else "outgoing",
            from_user=inv.from_user,
            to_user=inv.to_user,
            conversation_id=inv.conversation_id,
            created_at=inv.created_at,
        )
        for inv in rows
    ]


@router.post("/invites/{invite_id}/respond")
def respond_invite(invite_id: str, payload: schemas.InviteRespond, db: Session = Depends(get_db)):
    invite = db.query(models.Invite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.to_user_id != payload.user_id:
        raise HTTPException(status_code=403, detail="This invite isn't yours to respond to")
    if invite.status != models.InviteStatus.pending:
        raise HTTPException(status_code=400, detail="This invite was already responded to")

    if payload.action == "accept":
        if invite.conversation_id:
            # Group invite — join the existing conversation instead of
            # creating a new one.
            convo = db.query(models.Conversation).get(invite.conversation_id)
            if not convo:
                raise HTTPException(status_code=404, detail="That group no longer exists")
            already_in = (
                db.query(models.ConversationParticipant)
                .filter_by(conversation_id=convo.id, user_id=invite.to_user_id)
                .first()
            )
            if not already_in:
                db.add(models.ConversationParticipant(conversation_id=convo.id, user_id=invite.to_user_id))
            invite.status = models.InviteStatus.accepted
            db.commit()
            return {"status": "accepted", "conversation_id": convo.id}

        convo = models.Conversation(is_group=False)
        db.add(convo)
        db.commit()
        db.refresh(convo)
        db.add(models.ConversationParticipant(conversation_id=convo.id, user_id=invite.from_user_id))
        db.add(models.ConversationParticipant(conversation_id=convo.id, user_id=invite.to_user_id))
        invite.status = models.InviteStatus.accepted
        db.commit()
        return {"status": "accepted", "conversation_id": convo.id}

    elif payload.action == "decline":
        invite.status = models.InviteStatus.declined
        db.commit()
        return {"status": "declined", "conversation_id": None}

    raise HTTPException(status_code=400, detail="action must be 'accept' or 'decline'")


# ---------------------------------------------------------------------------
# REST: group chat creation
# ---------------------------------------------------------------------------

@router.post("/conversations/group", response_model=schemas.GroupChatCreateResponse)
def create_group_chat(payload: schemas.GroupChatCreate, db: Session = Depends(get_db)):
    creator = db.query(models.User).get(payload.creator_id)
    if not creator:
        raise HTTPException(status_code=404, detail="Your account was not found")

    cleaned_ids = [cid.strip().lower() for cid in payload.convoai_ids if cid.strip()]
    if not cleaned_ids:
        raise HTTPException(status_code=400, detail="Add at least one person to invite")

    convo = models.Conversation(name=(payload.name or "").strip() or None, is_group=True)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    db.add(models.ConversationParticipant(conversation_id=convo.id, user_id=creator.id))
    db.commit()

    results: list[schemas.GroupInviteResult] = []
    for cid in cleaned_ids:
        target = db.query(models.User).filter_by(username=cid).first()
        if not target:
            results.append(schemas.GroupInviteResult(convoai_id=cid, status="not_found", detail="No one has that ConvoAI ID"))
            continue
        if target.id == creator.id:
            results.append(schemas.GroupInviteResult(convoai_id=cid, status="error", detail="That's you"))
            continue

        existing = (
            db.query(models.Invite)
            .filter_by(conversation_id=convo.id, to_user_id=target.id)
            .first()
        )
        if existing:
            results.append(schemas.GroupInviteResult(convoai_id=cid, status="already_invited"))
            continue

        db.add(models.Invite(from_user_id=creator.id, to_user_id=target.id, conversation_id=convo.id))
        db.commit()
        results.append(schemas.GroupInviteResult(convoai_id=cid, status="invited"))

    return schemas.GroupChatCreateResponse(conversation_id=convo.id, results=results)


# ---------------------------------------------------------------------------
# REST: conversations
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}/conversations", response_model=list[schemas.ConversationSummaryOut])
def get_user_conversations(user_id: str, db: Session = Depends(get_db)):
    """Chat-list data for the home screen: every conversation this user is in,
    with a title and a last-message preview, newest first."""
    participant_rows = db.query(models.ConversationParticipant).filter_by(user_id=user_id).all()

    summaries = []
    for pr in participant_rows:
        convo = pr.conversation
        if not convo:
            continue

        last_msg = (
            db.query(models.Message)
            .filter_by(conversation_id=convo.id)
            .order_by(models.Message.created_at.desc())
            .first()
        )

        other_participants = (
            db.query(models.ConversationParticipant)
            .filter(
                models.ConversationParticipant.conversation_id == convo.id,
                models.ConversationParticipant.user_id != user_id,
            )
            .all()
        )
        other_names = [p.user.display_name for p in other_participants if p.user]
        title = convo.name or (", ".join(other_names) if other_names else "Just you")

        if last_msg is None:
            preview = "Say hi 👋"
            last_at = convo.created_at
        elif last_msg.deleted:
            preview = "Message deleted"
            last_at = last_msg.created_at
        elif last_msg.kind == "places":
            preview = "📍 Nearby places"
            last_at = last_msg.created_at
        elif last_msg.kind == "poll":
            preview = "📊 Poll"
            last_at = last_msg.created_at
        else:
            preview = last_msg.content[:80]
            last_at = last_msg.created_at

        summaries.append(schemas.ConversationSummaryOut(
            id=convo.id,
            title=title,
            is_group=convo.is_group,
            last_message_preview=preview,
            last_message_at=last_at,
        ))

    summaries.sort(key=lambda s: s.last_message_at, reverse=True)
    return summaries


@router.get("/conversations/{conversation_id}/messages", response_model=list[schemas.MessageOut])
def get_messages(conversation_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(models.Message.created_at)
        .all()
    )
    likes_by_message = _likes_by_message(db, [m.id for m in rows])

    out = []
    for m in rows:
        if m.sender_type == models.SenderType.ai:
            sender_name = AI_DISPLAY_NAME
        else:
            sender_name = m.sender.display_name if m.sender else "Unknown"
        out.append(schemas.MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            sender_id=m.sender_id,
            sender_type=m.sender_type.value,
            sender_name=sender_name,
            kind=m.kind,
            content=m.content,
            parent_message_id=m.parent_message_id,
            deleted=m.deleted,
            liked_user_ids=likes_by_message.get(m.id, []),
            created_at=m.created_at,
        ))
    return out


def _likes_by_message(db: Session, message_ids: list[str]) -> dict:
    if not message_ids:
        return {}
    rows = db.query(models.MessageLike).filter(models.MessageLike.message_id.in_(message_ids)).all()
    result: dict = {}
    for r in rows:
        result.setdefault(r.message_id, []).append(r.user_id)
    return result


# ---------------------------------------------------------------------------
# WebSocket: live chat + AI + reactions/replies/polls/delete
# ---------------------------------------------------------------------------

@app.websocket("/ws/{conversation_id}")
async def chat_socket(websocket: WebSocket, conversation_id: str, db: Session = Depends(get_db)):
    await manager.connect(conversation_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            event = json.loads(raw)
            event_type = event.get("type")

            if event_type == "message":
                await handle_new_message(db, conversation_id, event)
            elif event_type == "swipe_ai":
                await handle_swipe_ai(db, conversation_id, event)
            elif event_type == "find_nearby":
                await handle_find_nearby(db, conversation_id, event)
            elif event_type == "web_search":
                await handle_web_search(db, conversation_id, event)
            elif event_type == "toggle_like":
                await handle_toggle_like(db, conversation_id, event)
            elif event_type == "delete_message":
                await handle_delete_message(db, conversation_id, event)
            elif event_type == "create_poll":
                await handle_create_poll(db, conversation_id, event)
            elif event_type == "vote_poll":
                await handle_vote_poll(db, conversation_id, event)

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)


async def handle_new_message(db: Session, conversation_id: str, event: dict) -> None:
    msg = models.Message(
        conversation_id=conversation_id,
        sender_id=event["sender_id"],
        sender_type=models.SenderType.user,
        content=event["content"],
        parent_message_id=event.get("parent_message_id"),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    sender = db.query(models.User).get(event["sender_id"])
    await manager.broadcast(conversation_id, {
        "type": "message",
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": sender.display_name if sender else "Unknown",
        "sender_type": "user",
        "kind": "text",
        "content": msg.content,
        "parent_message_id": msg.parent_message_id,
        "deleted": False,
        "liked_user_ids": [],
        "created_at": msg.created_at.isoformat(),
    })


async def handle_swipe_ai(db: Session, conversation_id: str, event: dict) -> None:
    """event = {"type": "swipe_ai", "message_id": <id of the swiped message>}"""
    swiped = db.query(models.Message).get(event["message_id"])
    if not swiped:
        return

    await manager.broadcast(conversation_id, {"type": "ai_typing", "message_id": swiped.id})

    history_rows = (
        db.query(models.Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(models.Message.created_at)
        .limit(settings.AI_CONTEXT_MESSAGE_LIMIT)
        .all()
    )

    def sender_name(m: models.Message) -> str:
        if m.sender_type == models.SenderType.ai:
            return AI_DISPLAY_NAME
        u = db.query(models.User).get(m.sender_id)
        return u.display_name if u else "Unknown"

    history = [{"sender_name": sender_name(m), "content": m.content} for m in history_rows]
    swiped_payload = {"sender_name": sender_name(swiped), "content": swiped.content}

    # NOTE: this is a blocking call on the event loop. Fine for a prototype;
    # swap for the async client + a background task once you add load.
    try:
        reply_text = get_ai_reply(history, swiped_payload)
    except Exception as exc:
        print(f"[swipe_ai] Gemini call failed: {exc}")
        await manager.broadcast(conversation_id, {
            "type": "ai_error",
            "message_id": swiped.id,
            "error": _friendly_gemini_error(exc),
        })
        return

    ai_msg = models.Message(
        conversation_id=conversation_id,
        sender_id=None,
        sender_type=models.SenderType.ai,
        content=reply_text,
        parent_message_id=swiped.id,
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    await manager.broadcast(conversation_id, {
        "type": "message",
        "id": ai_msg.id,
        "sender_id": None,
        "sender_name": AI_DISPLAY_NAME,
        "sender_type": "ai",
        "kind": "text",
        "content": ai_msg.content,
        "parent_message_id": swiped.id,
        "deleted": False,
        "liked_user_ids": [],
        "created_at": ai_msg.created_at.isoformat(),
    })


async def handle_find_nearby(db: Session, conversation_id: str, event: dict) -> None:
    requester_id = event.get("requester_id")
    query = (event.get("query") or "restaurants").strip()
    lat = event.get("lat")
    lng = event.get("lng")
    address = event.get("address")

    await manager.broadcast(conversation_id, {"type": "places_searching", "requester_id": requester_id})

    try:
        data = find_nearby_places(query=query, max_results=10, lat=lat, lng=lng, address=address)
    except Exception as exc:
        print(f"[find_nearby] Gemini Maps grounding failed: {exc}")
        await manager.broadcast(conversation_id, {
            "type": "ai_error",
            "message_id": None,
            "error": _friendly_gemini_error(exc),
        })
        return

    requester = db.query(models.User).get(requester_id)
    label = f'{query.title()} near {requester.display_name if requester else "you"}'
    payload = {"label": label, "results": data["results"], "sources": data["sources"]}

    msg = models.Message(
        conversation_id=conversation_id,
        sender_id=None,
        sender_type=models.SenderType.ai,
        kind="places",
        content=json.dumps(payload),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    await manager.broadcast(conversation_id, {
        "type": "message",
        "id": msg.id,
        "sender_id": None,
        "sender_name": AI_DISPLAY_NAME,
        "sender_type": "ai",
        "kind": "places",
        "content": msg.content,
        "parent_message_id": None,
        "deleted": False,
        "liked_user_ids": [],
        "created_at": msg.created_at.isoformat(),
    })


async def handle_web_search(db: Session, conversation_id: str, event: dict) -> None:
    """event = {"type": "web_search", "requester_id": ..., "query": "..."}"""
    query = (event.get("query") or "").strip()
    if not query:
        return

    await manager.broadcast(conversation_id, {"type": "web_searching"})

    try:
        data = get_web_answer(query)
    except Exception as exc:
        print(f"[web_search] Tavily/Gemini pipeline failed: {exc}")
        await manager.broadcast(conversation_id, {
            "type": "ai_error",
            "message_id": None,
            "error": _friendly_gemini_error(exc),
        })
        return

    payload = {"query": query, "answer": data["answer"], "sources": data["sources"]}

    msg = models.Message(
        conversation_id=conversation_id,
        sender_id=None,
        sender_type=models.SenderType.ai,
        kind="websearch",
        content=json.dumps(payload),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    await manager.broadcast(conversation_id, {
        "type": "message",
        "id": msg.id,
        "sender_id": None,
        "sender_name": AI_DISPLAY_NAME,
        "sender_type": "ai",
        "kind": "websearch",
        "content": msg.content,
        "parent_message_id": None,
        "deleted": False,
        "liked_user_ids": [],
        "created_at": msg.created_at.isoformat(),
    })


async def handle_toggle_like(db: Session, conversation_id: str, event: dict) -> None:
    message_id = event.get("message_id")
    user_id = event.get("user_id")
    if not message_id or not user_id:
        return

    existing = db.query(models.MessageLike).filter_by(message_id=message_id, user_id=user_id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(models.MessageLike(message_id=message_id, user_id=user_id))
    db.commit()

    liked_user_ids = [r.user_id for r in db.query(models.MessageLike).filter_by(message_id=message_id).all()]
    await manager.broadcast(conversation_id, {
        "type": "message_liked",
        "message_id": message_id,
        "liked_user_ids": liked_user_ids,
    })


async def handle_delete_message(db: Session, conversation_id: str, event: dict) -> None:
    message_id = event.get("message_id")
    requester_id = event.get("requester_id")

    msg = db.query(models.Message).get(message_id)
    if not msg or msg.sender_id != requester_id:
        return

    msg.deleted = True
    db.commit()

    await manager.broadcast(conversation_id, {"type": "message_deleted", "message_id": message_id})


async def handle_create_poll(db: Session, conversation_id: str, event: dict) -> None:
    message_id = event.get("message_id")
    requester_id = event.get("requester_id")
    question = (event.get("question") or "").strip()
    options = [o.strip() for o in (event.get("options") or []) if o.strip()]

    msg = db.query(models.Message).get(message_id)
    if not msg or msg.sender_id != requester_id or not question or len(options) < 2:
        return

    poll_data = {
        "question": question,
        "options": [{"id": i, "text": text} for i, text in enumerate(options)],
        "votes": {},
    }
    msg.kind = "poll"
    msg.content = json.dumps(poll_data)
    db.commit()

    await manager.broadcast(conversation_id, {
        "type": "message_updated", "message_id": msg.id, "kind": "poll", "content": msg.content,
    })


async def handle_vote_poll(db: Session, conversation_id: str, event: dict) -> None:
    message_id = event.get("message_id")
    user_id = event.get("user_id")
    option_id = event.get("option_id")

    msg = db.query(models.Message).get(message_id)
    if not msg or msg.kind != "poll":
        return

    data = json.loads(msg.content)
    votes = data.setdefault("votes", {})
    for voters in votes.values():
        if user_id in voters:
            voters.remove(user_id)

    key = str(option_id)
    votes.setdefault(key, [])
    if user_id not in votes[key]:
        votes[key].append(user_id)

    msg.content = json.dumps(data)
    db.commit()

    await manager.broadcast(conversation_id, {
        "type": "message_updated", "message_id": msg.id, "kind": "poll", "content": msg.content,
    })


# All REST endpoints defined above via @router.* live under /api/... — this
# is what lets Nginx route /api/* to this backend and everything else to
# the built frontend, all on one domain with no CORS juggling needed.
app.include_router(router, prefix="/api")
