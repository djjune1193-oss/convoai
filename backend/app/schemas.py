from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class UserCreate(BaseModel):
    display_name: str


class SignupRequest(BaseModel):
    username: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str  # the ConvoAI ID
    display_name: str
    avatar_url: Optional[str] = None
    status: Optional[str] = None
    work: Optional[str] = None
    sports: Optional[str] = None
    hobbies: Optional[str] = None

    class Config:
        from_attributes = True


class UserBrief(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    status: Optional[str] = None
    work: Optional[str] = None
    sports: Optional[str] = None
    hobbies: Optional[str] = None


class ConversationCreate(BaseModel):
    name: Optional[str] = None
    user_ids: List[str]


class ConversationOut(BaseModel):
    id: str
    name: Optional[str]
    is_group: bool

    class Config:
        from_attributes = True


class ConversationSummaryOut(BaseModel):
    id: str
    title: str
    is_group: bool
    last_message_preview: Optional[str]
    last_message_at: datetime


class JoinConversationRequest(BaseModel):
    user_id: str


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: Optional[str]
    sender_type: str
    sender_name: str
    kind: str
    content: str
    parent_message_id: Optional[str]
    deleted: bool
    liked_user_ids: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class InviteCreate(BaseModel):
    from_user_id: str
    to_convoai_id: str  # the recipient's ConvoAI ID (username)


class InviteRespond(BaseModel):
    user_id: str
    action: str  # "accept" | "decline"


class InviteOut(BaseModel):
    id: str
    status: str
    direction: str  # "incoming" | "outgoing", relative to the requesting user
    from_user: UserBrief
    to_user: UserBrief
    conversation_id: Optional[str] = None  # set = this invite joins an existing (group) conversation
    created_at: datetime


class UserSearchResult(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    status: Optional[str] = None
    work: Optional[str] = None
    sports: Optional[str] = None
    hobbies: Optional[str] = None

    class Config:
        from_attributes = True


class GroupChatCreate(BaseModel):
    creator_id: str
    name: Optional[str] = None
    convoai_ids: List[str]


class GroupInviteResult(BaseModel):
    convoai_id: str
    status: str  # "invited" | "not_found" | "already_invited" | "error"
    detail: Optional[str] = None


class GroupChatCreateResponse(BaseModel):
    conversation_id: str
    results: List[GroupInviteResult]


class AuthResponse(BaseModel):
    token: str
    user: UserOut
