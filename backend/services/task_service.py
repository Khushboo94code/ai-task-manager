import uuid
from datetime import datetime, timezone
from typing import Optional

VALID_STATUSES = {"pending", "in_progress", "completed"}
VALID_PRIORITIES = {"low", "medium", "high"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# In-memory store with seed data
# ---------------------------------------------------------------------------
_tasks: list[dict] = [
    {
        "id": "task-001",
        "title": "Fix login button on mobile Safari",
        "description": "The login button is not responding on mobile Safari iOS 17+. Investigate CSS touch event handling and test across devices.",
        "status": "in_progress",
        "priority": "high",
        "dueDate": "2026-10-28",
        "createdAt": "2026-10-25T09:00:00+00:00",
        "updatedAt": "2026-10-25T09:00:00+00:00",
        "createdBy": "user",
    },
    {
        "id": "task-002",
        "title": "Add pagination to task list API",
        "description": "The task list endpoint currently returns all tasks. Add limit and offset query parameters. Default limit should be 20.",
        "status": "pending",
        "priority": "medium",
        "dueDate": "2026-11-05",
        "createdAt": "2026-10-24T14:00:00+00:00",
        "updatedAt": "2026-10-24T14:00:00+00:00",
        "createdBy": "user",
    },
    {
        "id": "task-003",
        "title": "Update README with setup instructions",
        "description": "The README is outdated. Add clear local setup instructions for both frontend and backend including environment variables.",
        "status": "pending",
        "priority": "low",
        "dueDate": None,
        "createdAt": "2026-10-23T10:00:00+00:00",
        "updatedAt": "2026-10-23T10:00:00+00:00",
        "createdBy": "user",
    },
    {
        "id": "task-004",
        "title": "Refactor authentication middleware",
        "description": "The auth middleware has duplicated validation logic in three places. Extract it into a shared helper function.",
        "status": "completed",
        "priority": "medium",
        "dueDate": "2026-10-26",
        "createdAt": "2026-10-20T08:00:00+00:00",
        "updatedAt": "2026-10-26T16:00:00+00:00",
        "createdBy": "user",
    },
    {
        "id": "task-005",
        "title": "Investigate memory leak in WebSocket handler",
        "description": "Memory usage grows ~50MB per hour. Suspect event listeners are not being removed on connection close. Reproduce and fix.",
        "status": "pending",
        "priority": "high",
        "dueDate": "2026-10-30",
        "createdAt": "2026-10-26T11:00:00+00:00",
        "updatedAt": "2026-10-26T11:00:00+00:00",
        "createdBy": "user",
    },
    {
        "id": "task-006",
        "title": "Fix login redirect loop on token expiry",
        "description": "When the auth token expires mid-session the user gets stuck in a redirect loop instead of being sent to the login page cleanly.",
        "status": "pending",
        "priority": "high",
        "dueDate": "2026-10-29",
        "createdAt": "2026-10-27T08:00:00+00:00",
        "updatedAt": "2026-10-27T08:00:00+00:00",
        "createdBy": "user",
    },
]


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------

def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    due_before: Optional[str] = None,
    q: Optional[str] = None,
) -> list[dict]:
    result = list(_tasks)
    if status:
        result = [t for t in result if t["status"] == status]
    if priority:
        result = [t for t in result if t["priority"] == priority]
    if due_before:
        result = [t for t in result if t.get("dueDate") and t["dueDate"] <= due_before]
    if q:
        q_lower = q.lower()
        result = [
            t for t in result
            if q_lower in t["title"].lower() or q_lower in t["description"].lower()
        ]
    return result


def get_task(task_id: str) -> Optional[dict]:
    return next((t for t in _tasks if t["id"] == task_id), None)


def create_task(
    title: str,
    description: str = "",
    status: str = "pending",
    priority: str = "medium",
    due_date: Optional[str] = None,
    created_by: str = "user",
) -> dict:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Must be one of: {', '.join(VALID_STATUSES)}")
    if priority not in VALID_PRIORITIES:
        raise ValueError(f"Invalid priority '{priority}'. Must be one of: {', '.join(VALID_PRIORITIES)}")

    now = _now()
    task = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "status": status,
        "priority": priority,
        "dueDate": due_date,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": created_by,
    }
    _tasks.append(task)
    return task


def update_task(task_id: str, fields: dict) -> Optional[dict]:
    task = get_task(task_id)
    if not task:
        return None

    allowed = {"title", "description", "status", "priority", "dueDate"}
    for key, value in fields.items():
        if key in allowed and value is not None:
            if key == "status" and value not in VALID_STATUSES:
                raise ValueError(f"Invalid status '{value}'")
            if key == "priority" and value not in VALID_PRIORITIES:
                raise ValueError(f"Invalid priority '{value}'")
            task[key] = value

    task["updatedAt"] = _now()
    return task


def delete_task(task_id: str) -> bool:
    for i, t in enumerate(_tasks):
        if t["id"] == task_id:
            _tasks.pop(i)
            return True
    return False
