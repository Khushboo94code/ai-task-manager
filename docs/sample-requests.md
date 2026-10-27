# Sample Requests and Responses

All requests go to `http://localhost:8001`. The frontend proxies `/api/*` there via Vite.

---

## REST API Endpoints

### 1. List all tasks

```http
GET /api/tasks HTTP/1.1
Host: localhost:8001
```

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "task-001",
      "title": "Fix login button on mobile Safari",
      "status": "in_progress",
      "priority": "high",
      "dueDate": "2026-10-28",
      "createdAt": "2026-10-25T09:00:00+00:00",
      "updatedAt": "2026-10-25T09:00:00+00:00",
      "createdBy": "user"
    }
  ],
  "count": 6
}
```

### 2. Create a task

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

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "c8f2a3b1-4d5e-...",
    "title": "Write unit tests for auth service",
    "description": "Cover happy path and expired token cases",
    "status": "pending",
    "priority": "high",
    "dueDate": "2026-11-01",
    "createdAt": "2026-10-28T10:00:00+00:00",
    "updatedAt": "2026-10-28T10:00:00+00:00",
    "createdBy": "user"
  }
}
```

### 3. Update a task

```http
PUT /api/tasks/task-002 HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "status": "in_progress",
  "priority": "high"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "task-002",
    "title": "Add pagination to task list API",
    "status": "in_progress",
    "priority": "high",
    "dueDate": "2026-11-05",
    "updatedAt": "2026-10-28T10:01:00+00:00"
  }
}
```

### 4. Delete a task

```http
DELETE /api/tasks/task-003 HTTP/1.1
Host: localhost:8001
```

**Response `200`**
```json
{
  "success": true,
  "message": "Task deleted"
}
```

### 5. Validation error — missing title

```http
POST /api/tasks HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{
  "description": "No title provided"
}
```

**Response `400`**
```json
{
  "detail": "title is required"
}
```

---

## AI Assistant — 8 Required Test Cases

All assistant requests: `POST /api/assistant/chat`

---

### Test 1 — KB-only route: policy question answered from knowledge base

**Request**
```json
{
  "message": "What does high priority mean?",
  "sessionId": "test-session-1",
  "idempotencyKey": "test-session-1-001"
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

### Test 2 — Tool-only route: list tasks by status

**Request**
```json
{
  "message": "Show me all pending tasks",
  "sessionId": "test-session-2",
  "idempotencyKey": "test-session-2-001"
}
```

**Response**
```json
{
  "answer": "Here are your pending tasks:\n\n1. **Add pagination to task list API** (task-002) — medium priority, due 2026-11-05\n2. **Update README with setup instructions** (task-003) — low priority, no due date\n3. **Investigate memory leak in WebSocket handler** (task-005) — high priority, due 2026-10-30\n4. **Fix login redirect loop on token expiry** (task-006) — high priority, due 2026-10-29",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "list_tasks",
      "arguments": { "status": "pending" },
      "result": [ "...4 tasks..." ]
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

### Test 3 — Both KB and tool: task action + policy question in one message

**Request**
```json
{
  "message": "Mark task-005 as in_progress, and what does in_progress status mean?",
  "sessionId": "test-session-3",
  "idempotencyKey": "test-session-3-001"
}
```

**Response**
```json
{
  "answer": "Done — I've updated task-005 (\"Investigate memory leak in WebSocket handler\") to in_progress.\n\nAccording to team policy, **in_progress** means you are actively working on the task. You should keep the status updated and flag blockers as soon as they arise.",
  "route": "both",
  "evidence": [
    {
      "docId": "status_lifecycle",
      "title": "Status Lifecycle",
      "score": "0.38",
      "snippet": "In progress means the assignee is actively working on the task..."
    }
  ],
  "toolCalls": [
    {
      "name": "update_task",
      "arguments": { "id": "task-005", "status": "in_progress" },
      "result": { "id": "task-005", "status": "in_progress", "..." : "..." }
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

### Test 4 — Out-of-scope: question unrelated to task management

**Request**
```json
{
  "message": "What's the weather in Delhi today?",
  "sessionId": "test-session-4",
  "idempotencyKey": "test-session-4-001"
}
```

**Response**
```json
{
  "answer": "This is outside my scope. I only help with task management — creating, updating, deleting, and querying tasks, as well as answering questions about how the team works.",
  "route": "none",
  "evidence": [],
  "toolCalls": [],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

### Test 5 — Empty message: guard rejects before LLM call

**Request**
```json
{
  "message": "   ",
  "sessionId": "test-session-5",
  "idempotencyKey": "test-session-5-001"
}
```

**Response**
```json
{
  "answer": "Please type a message.",
  "route": "none",
  "evidence": [],
  "toolCalls": [],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

*No LLM call is made. The guard layer returns immediately.*

---

### Test 6 — Task not found: tool returns error, LLM reports it

**Request**
```json
{
  "message": "Get details for task-999",
  "sessionId": "test-session-6",
  "idempotencyKey": "test-session-6-001"
}
```

**Response**
```json
{
  "answer": "I couldn't find a task with ID task-999. It may have been deleted or the ID might be incorrect. You can ask me to list all tasks to see what's available.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "get_task",
      "arguments": { "id": "task-999" },
      "result": { "error": "Task not found", "id": "task-999" }
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

### Test 7 — Delete with confirmation: two-step destructive flow

**Step 1 — Request delete**
```json
{
  "message": "Delete task-003",
  "sessionId": "test-session-7",
  "idempotencyKey": "test-session-7-001"
}
```

**Response — pending confirmation**
```json
{
  "answer": "I found the task \"Update README with setup instructions\" (task-003, low priority). Are you sure you want to delete it? This action cannot be undone.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "delete_task",
      "arguments": { "id": "task-003" },
      "result": "PENDING_CONFIRMATION"
    }
  ],
  "needsConfirmation": true,
  "pendingActionId": "pend-7f2a3c..."
}
```

**Step 2 — User clicks Confirm Delete**
```json
{
  "message": "confirmed",
  "sessionId": "test-session-7",
  "confirm": true,
  "pendingActionId": "pend-7f2a3c..."
}
```

**Response — executed**
```json
{
  "answer": "Task deleted successfully.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "delete_task",
      "arguments": { "id": "task-003" },
      "result": { "success": true, "id": "task-003" }
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

---

### Test 8 — Idempotency: duplicate create returns cached result, no second task created

**Request (first send)**
```json
{
  "message": "Create a task: Fix Celery worker crash, high priority, due 2026-11-01, no description",
  "sessionId": "test-session-8",
  "idempotencyKey": "test-session-8-send-1"
}
```

**Response**
```json
{
  "answer": "Done! I've created the task \"Fix Celery worker crash\" with high priority, due 2026-11-01.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "create_task",
      "arguments": { "title": "Fix Celery worker crash", "priority": "high", "dueDate": "2026-11-01", "description": "" },
      "result": { "id": "d3e9f1...", "title": "Fix Celery worker crash", "..." : "..." }
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

**Duplicate request (same idempotencyKey, e.g. network retry)**
```json
{
  "message": "Create a task: Fix Celery worker crash, high priority, due 2026-11-01, no description",
  "sessionId": "test-session-8",
  "idempotencyKey": "test-session-8-send-1"
}
```

**Response — identical cached result, no LLM call, no second task created**
```json
{
  "answer": "Done! I've created the task \"Fix Celery worker crash\" with high priority, due 2026-11-01.",
  "route": "tool",
  "evidence": [],
  "toolCalls": [
    {
      "name": "create_task",
      "arguments": { "title": "Fix Celery worker crash", "priority": "high", "dueDate": "2026-11-01", "description": "" },
      "result": { "id": "d3e9f1...", "title": "Fix Celery worker crash", "..." : "..." }
    }
  ],
  "needsConfirmation": false,
  "pendingActionId": null
}
```

*The task count in the system stays at 7, not 8. The idempotency guard short-circuits before any LLM or tool call.*
