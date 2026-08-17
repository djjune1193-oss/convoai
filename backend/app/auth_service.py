"""
Password hashing (bcrypt) and JWT session tokens for the login system.

Scope note: this covers signup/login/session-restore only. The rest of the
API (WebSocket events, most REST endpoints) still trusts a client-supplied
user_id directly rather than re-verifying the JWT on every call — that's a
real gap, not an oversight, and worth closing before this holds data from
people who aren't you testing it.
"""

import datetime
import re

import bcrypt
import jwt

from .config import settings

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]{3,20}$")


def validate_username(raw: str) -> str:
    """Normalizes to lowercase and validates format. Raises ValueError with
    a user-facing message if invalid."""
    username = raw.strip().lower()
    if not USERNAME_RE.fullmatch(username):
        raise ValueError(
            "User ID must be 3-20 characters: letters, numbers, underscores, or hyphens only."
        )
    return username


def validate_password(password: str) -> None:
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, AttributeError):
        return False


def create_token(user_id: str) -> str:
    now = datetime.datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + datetime.timedelta(days=settings.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> str | None:
    """Returns the user_id if the token is valid and unexpired, else None."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
