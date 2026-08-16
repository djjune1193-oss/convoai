import json
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """Tracks live sockets per conversation and broadcasts events to all of them."""

    def __init__(self) -> None:
        self.active: Dict[str, Set[WebSocket]] = {}

    async def connect(self, conversation_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.active.setdefault(conversation_id, set()).add(ws)

    def disconnect(self, conversation_id: str, ws: WebSocket) -> None:
        conns = self.active.get(conversation_id)
        if conns and ws in conns:
            conns.remove(ws)
            if not conns:
                del self.active[conversation_id]

    async def broadcast(self, conversation_id: str, message: dict) -> None:
        conns = list(self.active.get(conversation_id, set()))
        for ws in conns:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self.disconnect(conversation_id, ws)


manager = ConnectionManager()
