from collections import defaultdict
from typing import Any, Dict, Set

from fastapi import WebSocket


class TripWebSocketManager:
    def __init__(self):
        self.rooms: Dict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, trip_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms[trip_id].add(websocket)

    def disconnect(self, trip_id: int, websocket: WebSocket) -> None:
        self.rooms[trip_id].discard(websocket)
        if not self.rooms[trip_id]:
            self.rooms.pop(trip_id, None)

    async def broadcast(self, trip_id: int, event: str, payload: Dict[str, Any]) -> None:
        dead_connections = []
        for websocket in list(self.rooms.get(trip_id, set())):
            try:
                await websocket.send_json({"event": event, "payload": payload})
            except Exception:
                dead_connections.append(websocket)
        for websocket in dead_connections:
            self.disconnect(trip_id, websocket)


trip_ws_manager = TripWebSocketManager()
