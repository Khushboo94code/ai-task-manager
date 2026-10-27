from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services import assistant_service

router = APIRouter()


class ChatBody(BaseModel):
    message: str = ""
    sessionId: str = "default"
    confirm: bool = False
    pendingActionId: Optional[str] = None
    idempotencyKey: Optional[str] = None


@router.post("/chat")
async def chat(body: ChatBody):
    result = await assistant_service.chat(
        message=body.message,
        session_id=body.sessionId,
        confirm=body.confirm,
        pending_action_id=body.pendingActionId,
        idempotency_key=body.idempotencyKey,
    )
    return {"success": True, **result}
