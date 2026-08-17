import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class SenderType(str, enum.Enum):
    user = "user"
    ai = "ai"


class InviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String, unique=True, nullable=False)  # user-chosen login ID, also the shareable "ConvoAI ID"
    password_hash = Column(String, nullable=True)  # nullable for safe migration of pre-login accounts; always set on new signups
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    status = Column(String, nullable=True)  # short text shown over the profile photo
    work = Column(String, nullable=True)
    sports = Column(String, nullable=True)
    hobbies = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=True)
    is_group = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    participants = relationship("ConversationParticipant", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(String, primary_key=True, default=gen_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    user_id = Column(String, ForeignKey("users.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")


class Invite(Base):
    __tablename__ = "invites"

    id = Column(String, primary_key=True, default=gen_uuid)
    from_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    # If set, accepting this invite adds the user to this existing (group)
    # conversation instead of creating a new 1:1 one. Null = normal 1:1 invite.
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=True)
    status = Column(Enum(InviteStatus), default=InviteStatus.pending, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    conversation = relationship("Conversation")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    sender_id = Column(String, ForeignKey("users.id"), nullable=True)  # null when sender_type == ai
    sender_type = Column(Enum(SenderType), default=SenderType.user, nullable=False)
    kind = Column(String, default="text", nullable=False)  # "text" | "places" | "poll"
    content = Column(Text, nullable=False)
    parent_message_id = Column(String, ForeignKey("messages.id"), nullable=True)  # swiped msg or reply target
    deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class MessageLike(Base):
    __tablename__ = "message_likes"

    message_id = Column(String, ForeignKey("messages.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
