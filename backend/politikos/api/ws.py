"""WS /ws — clients subscribe by topic: race:{id}, feed, state:{XX}. Stub."""

from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            msg = await websocket.receive_json()
            # TODO: handle {action: "subscribe", topic: "race:12345"}
            await websocket.send_json({"echo": msg})
    except Exception:
        await websocket.close()
