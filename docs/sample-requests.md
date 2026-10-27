# Sample Requests and Responses

All requests go to `http://localhost:8001`. The frontend proxies `/api/*` there via Vite.

---

## 1. List all tasks

**Request**
```http
GET /api/tasks HTTP/1.1
Host: localhost:8001
```

**Response**
```json
{
  "data": [
    {
      "id": "task-001",
      "title": "Fix login button on mobile Safari",
      "description": "The login button is not responding on mobile Safari iOS 17+...",
      "status": "in_progress",
      "priority": "high",
      "dueDate": "2026-10-28",
      "createdAt": "2026-10-25T09:00:00+00:00",
      "updatedAt": "2026-10-25T09:00:00+00:00",
      "createdBy": "user"
    },
    { "...": "5 more tasks" }
  ]
}
```

---

## 2. Get a single task

**Request**
```http
GET /api/tasks/task-001 HTTP/1.1
Host: localhost:8001
```

**Response**
```json
{
  "id": "task-001",
  "title": "Fix login button on mobile Safari",
  "description": "The login button is not responding on mobile Safari iOS 17+...",
  "status": "in_progress",
  "priority": "high",
  "dueDate": "2026-10-28",
  "createdAt": "2026-10-25T09:00:00+00:00",
  "updatedAt": "2026-10-25T09:00:00+00:00",
  "createdBy": "user"
}
```

---

## 3. Create a task

**Request**
```http
POST /api/tasks HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "title": "Write unit tests for auth service",
  "description": "Cover happy path and expired token cases",
  "status": "pending",
  "priority": "high",
  "dueDate": "2026-11-01"
}
```

**Response** `201 Created`
```json
{
  "id": "c8f2a3b1-...",
  "title": "Write unit tests for auth service",
  "description": "Cover happy path and expired token cases",
  "status": "pending",
  "priority": "high",
  "dueDate": "2026-11-01",
  "createdAt": "2026-10-27T12:00:00+00:00",
  "updatedAt": "2026-10-27T12:00:00+00:00",
  "createdBy": "user"
}
```

---

## 4. Update a task

**Request**
```http
PATCH /api/tasks/task-002 HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "status": "in_progress",
  "priority": "high"
}
```

**Response**
```json
{
  "id": "task-002",
  "title": "Add pagination to task list API",
  "description": "The task list endpoint currently returns all tasks...",
  "status": "in_progress",
  "priority": "high",
  "dueDate": "2026-11-05",
  "createdAt": "2026-10-24T14:00:00+00:00",
  "updatedAt": "2026-10-27T12:01:00+00:00",
  "createdBy": "user"
}
```

---

## 5. Delete a task

**Request**
```http
DELETE /api/tasks/task-003 HTTP/1.1
Host: localhost:8001
```

**Response** `200 OK`
```json
{
  "message": "Task task-003 deleted"
}
```

---

## 6. AI chat — knowledge base query

Asking about a policy; the assistant retrieves from the KB and answers without calling any tool.

**Request**
```http
POST /api/assistant/chat HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "message": "What does high priority mean?",
  "sessionId": "session-abc",
  "idempotencyKey": "session-abc-1730000000001"
}
```

**Response**
```json
{
  "answer": "High priority tasks are blocking deliverables or directly affecting live users. They should be picked up within the same working day and given status updates at least every 4 hours.",
  "route": "kb",
  "evidence": [
    {
      "docId": "priority_definitions",
      "title": "Priority Definitions",
      "score": "0.52",
      "snippet": "High priority tasks are blocking deliverables or directly affecting live users..."
    }
  ],
  "toolCalls": [],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

## 7. AI chat — tool call (create task via assistant)

The assistant asks follow-up questions first. This example shows the final call after the user has provided all details.

**Request**
```http
POST /api/assistant/chat HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "message": "high priority, due 2026-11-01, no description needed",
  "sessionId": "session-abc",
  "idempotencyKey": "session-abc-1730000000005"
}
```

*(Prior turns in this session: user said "create a task for celery worker failures", assistant asked for description/priority/due date, user responded above)*

**Response**
```json
{
  "answer": "Done! I've created the task \"Celery workers going down frequently\" with high priority, due 2026-11-01.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "create_task",
      "args": {
        "title": "Celery workers going down frequently",
        "description": "",
        "priority": "high",
        "due_date": "2026-11-01"
      },
      "result": { "id": "d3e9...", "title": "Celery workers going down frequently" },
      "error": null
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

## 8. AI chat — delete with confirmation

The assistant does not immediately delete. It stores the pending action and asks for confirmation.

**Request**
```http
POST /api/assistant/chat HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "message": "delete task-003",
  "sessionId": "session-abc",
  "idempotencyKey": "session-abc-1730000000010"
}
```

**Response (confirmation prompt)**
```json
{
  "answer": "I found the task \"Update README with setup instructions\" (task-003). Are you sure you want to delete it? This cannot be undone.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "delete_task",
      "args": { "task_id": "task-003" },
      "result": null,
      "error": null
    }
  ],
  "needsConfirmation": true,
  "pendingActionId": "pend-7f2a..."
}
```

**Follow-up request (user clicks Confirm)**
```http
POST /api/assistant/chat HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "message": "confirmed",
  "sessionId": "session-abc",
  "confirm": true,
  "pendingActionId": "pend-7f2a..."
}
```

**Response**
```json
{
  "answer": "Task \"Update README with setup instructions\" has been deleted.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "delete_task",
      "args": { "task_id": "task-003" },
      "result": { "message": "Task task-003 deleted" },
      "error": null
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```
