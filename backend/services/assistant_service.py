import os
import json
import uuid
import time
from openai import AsyncOpenAI
from . import task_service
from .retrieval import knowledge_base

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
FORCE_TOOL_FAILURE = os.getenv("FORCE_TOOL_FAILURE", "false").lower() == "true"

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------
_pending_actions: dict[str, dict] = {}   # pendingActionId → {tool, args, expires_at}
_processed_keys: dict[str, dict] = {}    # idempotencyKey  → cached response

# Session store: session_id → {messages: [...], last_active: float}
# messages are plain {role, content} dicts — only user + assistant turns
# (tool call plumbing is never stored, it's rebuilt each call)
_sessions: dict[str, dict] = {}
SESSION_TTL = 30 * 60        # 30 minutes inactivity
MAX_HISTORY_TURNS = 20       # keep last 20 messages (10 exchanges) to stay within token limits


def _get_session_history(session_id: str) -> list[dict]:
    """Return stored history for a session, or empty list if new/expired."""
    session = _sessions.get(session_id)
    if not session:
        return []
    if time.time() - session["last_active"] > SESSION_TTL:
        _sessions.pop(session_id, None)
        return []
    return session["messages"]


def _save_session_history(session_id: str, messages: list[dict]) -> None:
    """Persist updated history, trimmed to MAX_HISTORY_TURNS."""
    _sessions[session_id] = {
        "messages": messages[-MAX_HISTORY_TURNS:],
        "last_active": time.time(),
    }


def _cleanup_expired_sessions() -> None:
    """Remove sessions that have been inactive longer than SESSION_TTL."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["last_active"] > SESSION_TTL]
    for sid in expired:
        _sessions.pop(sid, None)

# ---------------------------------------------------------------------------
# System prompt — enforces grounding (Part C requirement)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a task management assistant for a small software team.

STRICT RULES — follow these without exception:

1. POLICY QUESTIONS: Answer ONLY using the Knowledge Base documents provided in the context. If no documents are provided, or if the documents do not contain the answer, say exactly: "I cannot verify this — it is not in my knowledge base." Never use your general training knowledge to answer policy questions.

2. TASK DATA: Answer ONLY using results returned by tool calls. Never invent task IDs, titles, dates, priorities, statuses, or descriptions. If a tool returns an error or empty results, report that honestly.

3. ROUTING: For every message decide:
   - KB only: user is asking about policy, definitions, or how the team works
   - Tool only: user wants to see, create, update, or delete tasks
   - Both: user wants a task action AND a policy explanation (e.g. "create a task and tell me what priority it should be")
   - None: question is outside task management — say "This is outside my scope. I only help with task management."

4. TASK CREATION — ALWAYS follow this flow before calling create_task:
   a. If the user has not provided a description, ask for it. Never write the description yourself.
   b. If the user has not explicitly stated a priority, ask: "What priority should this be — low, medium, or high?"
   c. If the user has not mentioned a due date, ask: "Does this have a due date?" Never invent or assume a due date.
   d. Only call create_task AFTER the user has answered these questions.
   e. You may suggest a title based on what the user said, but confirm it before creating.
   f. If the user says "skip", "no", "leave it blank", "none", or similar for any optional field (description, due date, priority), accept it and proceed. Use an empty string for description if skipped, null for due date, and "medium" as default priority if skipped.
   Exception: if the user's message already contains all of title, description, priority, and due date (or explicitly says no due date), you may create immediately.

5. DELETE SAFETY: When asked to delete a task, always flag it for confirmation. Never delete without the user explicitly confirming.

6. AMBIGUITY: If a task reference matches more than one task (e.g. "the login task" matches two tasks), list the matches and ask the user to specify which one.

7. HONESTY: If uncertain or if a tool fails, say so clearly. Never guess or make up data.

Be concise and helpful."""

# ---------------------------------------------------------------------------
# Tool definitions passed to OpenAI
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List tasks. Optionally filter by status, priority, due date, or search query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "dueBefore": {"type": "string", "description": "ISO date string YYYY-MM-DD — return tasks due on or before this date"},
                    "q": {"type": "string", "description": "Search keyword to match against task title or description"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task",
            "description": "Get a single task by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "The task ID"},
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task. Title is required. Description is optional — use empty string if user skipped it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string", "description": "Task description. Use empty string if user skipped."},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                    "dueDate": {"type": "string", "description": "ISO date string YYYY-MM-DD. Omit if user did not specify."},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Update fields on an existing task by ID. Only provide fields you want to change.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "dueDate": {"type": "string"},
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task by ID. This is destructive and requires explicit user confirmation before executing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "The task ID to delete"},
                },
                "required": ["id"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# Tool executor — calls task_service, never duplicates logic
# ---------------------------------------------------------------------------
def _execute_tool(name: str, args: dict):
    if FORCE_TOOL_FAILURE:
        raise RuntimeError(f"Simulated tool failure: '{name}' is unavailable (FORCE_TOOL_FAILURE=true)")

    if name == "list_tasks":
        return task_service.list_tasks(
            status=args.get("status"),
            priority=args.get("priority"),
            due_before=args.get("dueBefore"),
            q=args.get("q"),
        )

    if name == "get_task":
        task = task_service.get_task(args["id"])
        return task if task else {"error": "Task not found", "id": args["id"]}

    if name == "create_task":
        return task_service.create_task(
            title=args["title"],
            description=args.get("description", ""),
            status=args.get("status", "pending"),
            priority=args.get("priority", "medium"),
            due_date=args.get("dueDate"),
            created_by="assistant",
        )

    if name == "update_task":
        task_id = args.pop("id")
        task = task_service.update_task(task_id, args)
        return task if task else {"error": "Task not found", "id": task_id}

    if name == "delete_task":
        deleted = task_service.delete_task(args["id"])
        return {"success": True, "id": args["id"]} if deleted else {"error": "Task not found", "id": args["id"]}

    raise ValueError(f"Unknown tool: {name}")


# ---------------------------------------------------------------------------
# Determine route label from what was actually used
# ---------------------------------------------------------------------------
def _determine_route(used_kb: bool, used_tools: bool) -> str:
    if used_kb and used_tools:
        return "both"
    if used_tools:
        return "tool"
    if used_kb:
        return "kb"
    return "none"


# ---------------------------------------------------------------------------
# Main chat function
# ---------------------------------------------------------------------------
async def chat(
    message: str,
    session_id: str = "default",
    confirm: bool = False,
    pending_action_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict:

    # Lazy cleanup of stale sessions on every call
    _cleanup_expired_sessions()

    # ------------------------------------------------------------------
    # GUARD 1: Empty message
    # ------------------------------------------------------------------
    if not message or not message.strip():
        return _response(answer="Please type a message.", route="none")

    # ------------------------------------------------------------------
    # GUARD 2: User is confirming a pending delete
    # ------------------------------------------------------------------
    if confirm and pending_action_id:
        pending = _pending_actions.get(pending_action_id)

        if not pending:
            return _response(
                answer="This confirmation has expired or was not found. Please try your delete request again.",
                route="none",
            )

        if time.time() > pending["expires_at"]:
            _pending_actions.pop(pending_action_id, None)
            return _response(
                answer="Confirmation timed out (5 minutes). Please request the delete again.",
                route="none",
            )

        try:
            result = _execute_tool(pending["tool"], pending["args"])
            _pending_actions.pop(pending_action_id, None)
            return _response(
                answer=f"Task deleted successfully.",
                route="tool",
                tool_calls=[{"name": pending["tool"], "arguments": pending["args"], "result": result}],
            )
        except Exception as e:
            return _response(
                answer=f"Failed to delete task: {str(e)}",
                route="tool",
                tool_calls=[{"name": pending["tool"], "arguments": pending["args"], "error": str(e)}],
            )

    # ------------------------------------------------------------------
    # GUARD 3: Duplicate request (idempotency)
    # ------------------------------------------------------------------
    if idempotency_key and idempotency_key in _processed_keys:
        return _processed_keys[idempotency_key]

    # ------------------------------------------------------------------
    # KB RETRIEVAL
    # ------------------------------------------------------------------
    kb_results = knowledge_base.search(message, top_k=3)
    relevant_docs = knowledge_base.get_above_threshold(kb_results)
    used_kb = len(relevant_docs) > 0

    # Build messages for OpenAI: system + history + current user message
    history = _get_session_history(session_id)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)

    if relevant_docs:
        kb_context = "\n\n---\n\n".join(
            f"[Document: {d['title']} | Relevance score: {d['score']}]\n{d['content']}"
            for d in relevant_docs
        )
        user_content = f"Knowledge Base Context:\n{kb_context}\n\n---\n\nUser: {message}"
    else:
        user_content = message

    messages.append({"role": "user", "content": user_content})

    # ------------------------------------------------------------------
    # FIRST LLM CALL — OpenAI decides what tools to call
    # ------------------------------------------------------------------
    tool_calls_log = []
    needs_confirmation = False
    new_pending_id = None

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            timeout=20,
        )
    except Exception as e:
        return _response(answer=f"The assistant is currently unavailable. Please try again. ({type(e).__name__})", route="none")

    assistant_msg = response.choices[0].message

    # ------------------------------------------------------------------
    # TOOL EXECUTION
    # ------------------------------------------------------------------
    if assistant_msg.tool_calls:
        messages.append(assistant_msg)  # add assistant turn with tool_calls

        for tc in assistant_msg.tool_calls:
            tool_name = tc.function.name
            tool_args = json.loads(tc.function.arguments)

            # delete_task needs confirmation — store and skip execution
            if tool_name == "delete_task":
                new_pending_id = str(uuid.uuid4())
                _pending_actions[new_pending_id] = {
                    "tool": tool_name,
                    "args": tool_args,
                    "expires_at": time.time() + 300,  # 5 minutes
                }
                needs_confirmation = True
                tool_calls_log.append({"name": tool_name, "arguments": tool_args, "result": "PENDING_CONFIRMATION"})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps({"status": "pending_confirmation", "message": "Awaiting user confirmation before deleting."}),
                })

            else:
                try:
                    result = _execute_tool(tool_name, tool_args)
                    tool_calls_log.append({"name": tool_name, "arguments": tool_args, "result": result})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })
                except Exception as e:
                    tool_calls_log.append({"name": tool_name, "arguments": tool_args, "error": str(e)})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps({"error": str(e)}),
                    })

        # SECOND LLM CALL — generate final answer using tool results
        try:
            response2 = await client.chat.completions.create(
                model=MODEL,
                messages=messages,
                timeout=20,
            )
            assistant_msg = response2.choices[0].message
        except Exception as e:
            return _response(answer=f"Got tool results but failed to generate final answer. ({type(e).__name__})", route="none")

    # ------------------------------------------------------------------
    # BUILD FINAL RESPONSE
    # ------------------------------------------------------------------
    used_tools = len(tool_calls_log) > 0
    route = _determine_route(used_kb, used_tools)

    evidence = [
        {"docId": d["docId"], "title": d["title"], "score": d["score"], "snippet": d["snippet"]}
        for d in relevant_docs
    ]

    result = _response(
        answer=assistant_msg.content or "I was unable to generate a response.",
        route=route,
        evidence=evidence,
        tool_calls=tool_calls_log,
        needs_confirmation=needs_confirmation,
        pending_action_id=new_pending_id,
    )

    # Cache write operations for idempotency
    is_write = any(tc["name"] in {"create_task", "update_task"} for tc in tool_calls_log)
    if idempotency_key and is_write:
        _processed_keys[idempotency_key] = result
        import asyncio
        asyncio.get_event_loop().call_later(3600, lambda: _processed_keys.pop(idempotency_key, None))

    # Persist conversation turn to session (only plain user/assistant text — no tool plumbing)
    updated_history = list(history)
    updated_history.append({"role": "user", "content": message})
    updated_history.append({"role": "assistant", "content": result["answer"]})
    _save_session_history(session_id, updated_history)

    return result


# ---------------------------------------------------------------------------
# Response builder — keeps shape consistent everywhere
# ---------------------------------------------------------------------------
def _response(
    answer: str,
    route: str,
    evidence: list = None,
    tool_calls: list = None,
    needs_confirmation: bool = False,
    pending_action_id: str | None = None,
) -> dict:
    return {
        "answer": answer,
        "route": route,
        "evidence": evidence or [],
        "toolCalls": tool_calls or [],
        "needsConfirmation": needs_confirmation,
        "pendingActionId": pending_action_id,
    }
