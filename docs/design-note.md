# Design Note — AI-Powered Task Manager

**Author:** Muskan Bansal  
**Date:** 2026-10-27

---

## Part C: Design Questions

---

### Q1. Five Technical Problems in the Given Workflow

The given workflow is: **User → LLM → Search KB → LLM → Task API (if needed) → LLM → Response**

**Problem 1 — Unconditional KB retrieval wastes tokens and injects noise**  
Every message — even a pure action like "create a task" — triggers a KB search. The LLM then receives potentially irrelevant documents alongside the user's message. This increases prompt size, adds latency (~200–400 ms), and risks the LLM hallucinating connections between the user's intent and unrelated policy text.

**Problem 2 — No idempotency guard**  
The workflow has no mechanism to detect duplicate requests. A slow network can cause the client to retry a POST, executing two `create_task` calls for the same user action. A double-click or browser refresh during a slow response causes the same. Without a deduplication layer, the data store gets corrupted silently.

**Problem 3 — Destructive actions execute without confirmation**  
The workflow routes directly to the Task API on the LLM's decision. A user who says "remove the login task" has no opportunity to review which task the LLM matched. A misidentification deletes the wrong record immediately and irreversibly. There is no pending-state buffer between intent and execution.

**Problem 4 — Three serial LLM calls add latency and multiply failure surface**  
The pipeline makes at minimum two LLM calls (and three if the API is invoked). Each call adds ~1–3 s of latency. More critically, each is an independent failure point: if the second LLM call times out, the response from the first (and the KB context built for it) is lost, and the user gets an error with no useful fallback. Serial calls also make it impossible to retry individual steps without replaying earlier ones.

**Problem 5 — No relevance threshold on KB results**  
The workflow passes KB results to the LLM regardless of their relevance score. A query about a specific task ("is task-003 overdue?") will pull the top-3 documents by cosine similarity even if all three score 0.02 — barely above noise. The LLM, presented with policy documents it didn't need, may use them to construct a plausible-sounding but incorrect answer (hallucination via weak evidence).

---

### Q2. Redesigned Workflow

The key insight is that retrieval and tool use are **independent decisions** and not every message needs either. The redesigned system routes each turn at the start based on what actually happened, not what might happen.

```
User message
     │
     ▼
┌─────────────────────────────────────────┐
│  Guard Layer                            │
│  • Empty message?  → reject early       │
│  • Duplicate idempotency key?  → return │
│    cached result (no LLM call)          │
│  • Pending confirm? → execute & return  │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  KB Retrieval (TF-IDF, threshold=0.1)  │
│  Run for every message but filter:      │
│  only pass docs with score ≥ 0.1       │
│  to the LLM. Low-quality results are   │
│  discarded here, not at the LLM.       │
└─────────────────────────────────────────┘
     │  0–3 relevant docs (may be 0)
     ▼
┌─────────────────────────────────────────┐
│  LLM Call 1                             │
│  Input: system prompt + session         │
│  history + (filtered KB docs) +         │
│  user message + tool definitions        │
└─────────────────────────────────────────┘
     │
     ├─── No tool call ──────────────────────► Final answer from Call 1
     │
     └─── Tool call requested
               │
               ▼
        ┌───────────────────────────────┐
        │  Tool Execution               │
        │  • Reads: execute immediately │
        │  • Writes (create/update):    │
        │    execute, cache result      │
        │  • Delete: store as pending,  │
        │    return confirmation prompt │
        └───────────────────────────────┘
               │ tool result(s)
               ▼
        ┌───────────────────────────────┐
        │  LLM Call 2                   │
        │  Input: Call 1 messages +     │
        │  tool results → final answer  │
        └───────────────────────────────┘
               │
               ▼
        Final answer from Call 2
     │
     ▼
┌─────────────────────────────────────────┐
│  Route Classification                   │
│  kb   → KB docs used, no tools         │
│  tool → tools called, no KB docs       │
│  both → KB docs + tools                │
│  none → neither                        │
└─────────────────────────────────────────┘
     │
     ▼
Save plain user + assistant text to session history → Return response
```

**Key differences from the original:**
- KB retrieval happens once, before any LLM call. The threshold filters bad results before they enter the prompt.
- At most two LLM calls (not three). The second call only happens when a tool is actually invoked.
- Writes are gated: deletes require a round-trip confirmation; all writes are idempotency-protected.
- Route is determined from what actually happened, enabling transparent observability in the UI.

---

### Q3. Idempotency Keys and State Preventing Duplicate Execution

**Scenario:** A user clicks "Send" to create a task. The request reaches the server and the task is created, but the network drops before the response arrives. The client retries with the same message.

**How idempotency prevents the duplicate:**

1. **Client generates a unique key per send event:** `idempotencyKey = "${sessionId}-${Date.now()}"`. This key is stable across retries of the same logical action — the client caches the key and resends it if retrying, rather than generating a new one.

2. **Server checks the key before touching the LLM or tools:**
   ```python
   if body.idempotencyKey and body.idempotencyKey in _processed_keys:
       cached = _processed_keys[body.idempotencyKey]
       return ChatResponse(**cached)   # no LLM call, no write
   ```

3. **Server stores the result after a successful write:**
   ```python
   _processed_keys[key] = {
       "answer": final_answer,
       "toolCalls": tool_calls,
       "route": route,
       ...
       "expires_at": time.time() + 300   # 5-minute TTL
   }
   ```

4. **The retry returns the cached result instantly.** The task is not created twice. The user sees the same "Task created" message.

**State that prevents duplicate deletes — the pending action pattern:**

Delete is not executed on the first request. Instead it is stored as pending state:
```python
_pending_actions[action_id] = {
    "tool": "delete_task",
    "args": {"task_id": "task-003"},
    "expires_at": time.time() + 300
}
```
The LLM cannot trigger the delete twice because there is nothing for it to retry — the first request returns a confirmation prompt, not a delete result. The actual deletion only runs when the client sends a second request with `confirm=True` and the matching `pendingActionId`. If the user never confirms, the pending action expires after 5 minutes.

**Why this combination matters:**  
Idempotency keys protect write calls (create/update) from network retries. The pending-action pattern protects destructive calls (delete) from LLM misidentification. Together they make every mutation safe to retry and explicit to confirm.

---

### Q4. Reducing LLM Use of Irrelevant Retrieved Documents

When retrieval returns three documents but only one is relevant, two strategies prevent the LLM from misusing the weak ones:

**Strategy 1 — Filter by score threshold before the prompt is built (primary defence)**  
Relevant documents are defined as those with TF-IDF cosine similarity ≥ 0.1. Documents that score below this threshold are dropped entirely and never appear in the LLM's context. The threshold was chosen empirically: a score of 0.1 on a 6-document KB means the query shares at least one meaningful overlapping term with the document after IDF weighting. Documents scoring 0.02–0.09 typically match only stop-words or very common tokens.

```python
def get_above_threshold(results, threshold=0.1):
    return [r for r in results if r["score"] >= threshold]
```

**Strategy 2 — Include the relevance score in the prompt**  
Each document snippet is prefixed with its score so the LLM can weight evidence proportionally:

```
[score: 0.41] priority_definitions.md
  High priority tasks are blocking deliverables or affect live users...

[score: 0.12] status_lifecycle.md
  Completed tasks are archived after 30 days...
```

A document scoring 0.12 carries less authority than one scoring 0.41. This discourages the LLM from treating a weakly-matched document as a primary source.

**Additional reinforcement in the system prompt:**  
Rule 6 in the system prompt says: "Only cite knowledge base documents when they are directly relevant to the user's question." This grounds the LLM's citation behaviour and reduces confident-but-wrong answers from loosely-matched documents.

---

### Q5. Timeouts, Retries, Backoff, and Why Retries Must Not Repeat Writes

**Timeouts**  
Every external call should have an explicit timeout. Without one, a stalled LLM API call will hold a server thread indefinitely. Recommended values:
- OpenAI API call: 15 s hard timeout, surface "AI assistant is temporarily unavailable" if exceeded
- Task API operations (in-memory in our case, but network calls in production): 3 s
- KB index query: 0.5 s (it's local; if it takes longer, something is wrong)

**Retries with exponential backoff**  
Transient failures (HTTP 429 rate-limited, 503 gateway timeout) should be retried. Retry immediately on the first failure, then back off:

```
Attempt 1 → fails → wait 1 s
Attempt 2 → fails → wait 2 s
Attempt 3 → fails → wait 4 s
Attempt 4 → final failure → return error to user
```

Jitter (adding a small random offset to each wait) prevents thundering-herd when many clients retry at the same time.

**Why retries must never repeat writes**  
A `create_task` call may have succeeded on the server before the connection dropped. The client never received the 200 response, so it believes the call failed. If the retry blindly re-sends the same create request, a second task is created — silent data corruption.

The rule is: **only retry idempotent operations** (reads: `list_tasks`, `get_task`). For writes, use the idempotency key pattern instead. The server recognises the same key on the retry and returns the cached result rather than executing the write again. The client gets its response; the task count stays at one.

**Fallback behaviour**
- If the LLM is unavailable after retries: return a static error message ("AI assistant is temporarily unavailable. You can still manage tasks using the form."). Do not surface a raw exception.
- If KB retrieval fails: log the error, skip KB context, and proceed with the LLM call using only session history. The answer may be less grounded but the user still gets a response.
- If a tool call fails (e.g., task not found on update): the LLM Call 2 receives the error as a tool result and explains it to the user in plain language ("I couldn't find a task with that ID").

---

### Q6. What to Log and Monitor in Production

**Hallucinations**  
Log the route (`kb` / `tool` / `both` / `none`) alongside the final answer text. When route is `none` but the answer makes specific factual claims about tasks or policies, flag for review. In production, a lightweight classifier can detect responses that reference task IDs not returned by any tool call — these are likely hallucinated identifiers.

**Poor retrieval**  
Log the KB query text, the top-3 document IDs, and their scores for every turn. Alert when:
- All scores are below threshold (no documents matched): the user's vocabulary may not overlap with the KB. This signals a gap in KB coverage or synonym definitions.
- Route is `kb` but the user later asks a follow-up that contradicts the KB answer: KB content may be stale or wrong.

**Tool failures**  
Log `tool_name`, `args` (sanitised — no PII), `success/error`, and execution time for every tool call. Emit a counter metric `tool_call_failures_total{tool="create_task"}`. Alert if the failure rate exceeds 5% over a 5-minute window.

**Slow requests**  
Log wall-clock latency from request receipt to response sent, broken down into: KB retrieval time, LLM Call 1 time, tool execution time, LLM Call 2 time. Alert on p95 total latency > 10 s. The breakdown identifies which stage is the bottleneck — KB index rebuild, LLM provider slowdown, or tool I/O.

**Session anomalies**  
Log session ID, message count, and time since last active. Alert when a pending delete action is older than 5 minutes (user likely forgot to confirm — a UX issue worth investigating). Alert on sessions with > 20 messages being truncated — may indicate the user is in a long debugging loop that the assistant is not resolving.

**Idempotency hit rate**  
Log each time a duplicate key is detected. A high hit rate (> 5% of requests) means the client is retrying aggressively, which may indicate slow response times triggering client-side timeouts.

---

### Q7. System Instruction for Grounding

> You are a task management assistant. Answer questions **only** from information that was returned by the retrieval system (shown as knowledge base documents) or verified through a tool call in this conversation. Do not rely on general training knowledge to state facts about tasks, due dates, priorities, or team policies. If a question cannot be answered from retrieved documents or tool results, say explicitly: **"I don't have enough information to answer that reliably — please check the task details directly."** Never infer, guess, or extrapolate beyond what the sources directly state.

**Why this instruction works:**  
It sets a single, enforceable rule (only retrieved information counts) and provides an exact phrase for the "I don't know" case. The specific fallback phrase prevents the LLM from hedging vaguely ("it might be...") while still sounding helpful. By naming both retrieval documents and tool results as the valid sources, it covers both the `kb` and `tool` routing paths and leaves no ambiguity about what "verified" means in this system.
