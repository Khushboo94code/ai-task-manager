from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from services import task_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class CreateTaskBody(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    dueDate: Optional[str] = None


class UpdateTaskBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("")
def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    dueBefore: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    tasks = task_service.list_tasks(status=status, priority=priority, due_before=dueBefore, q=q)
    return {"success": True, "data": tasks, "count": len(tasks)}


@router.get("/{task_id}")
def get_task(task_id: str):
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True, "data": task}


@router.post("", status_code=201)
def create_task(body: CreateTaskBody):
    if not body.title or not body.title.strip():
        raise HTTPException(status_code=400, detail="title is required")
    try:
        task = task_service.create_task(
            title=body.title,
            description=body.description,
            status=body.status,
            priority=body.priority,
            due_date=body.dueDate,
            created_by="user",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": task}


@router.put("/{task_id}")
def update_task(task_id: str, body: UpdateTaskBody):
    try:
        task = task_service.update_task(task_id, body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True, "data": task}


@router.delete("/{task_id}")
def delete_task(task_id: str):
    deleted = task_service.delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True, "message": "Task deleted"}
