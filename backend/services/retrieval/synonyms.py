SYNONYM_GROUPS = [
    ["task", "ticket", "job", "issue", "item", "assignment", "todo", "work", "request"],
    ["priority", "urgency", "importance", "severity", "criticality", "level"],
    ["high", "urgent", "critical", "important", "top", "blocker"],
    ["medium", "normal", "moderate", "mid", "average", "standard"],
    ["low", "minor", "trivial", "least", "small", "unimportant"],
    ["status", "state", "stage", "phase", "condition"],
    ["pending", "open", "unstarted", "waiting", "new", "queued", "backlog"],
    ["in_progress", "active", "ongoing", "started", "working", "wip", "progress", "doing"],
    ["completed", "done", "finished", "closed", "resolved", "complete", "delivered"],
    ["due", "deadline", "overdue", "late", "expiry", "date"],
    ["delete", "remove", "destroy", "erase", "drop", "cancel"],
    ["create", "add", "make", "new", "submit", "open", "raise"],
    ["update", "edit", "modify", "change", "rename", "patch"],
    ["show", "list", "get", "fetch", "find", "display", "view", "see"],
    ["difference", "vs", "versus", "compare", "comparison", "between"],
    ["title", "name", "heading", "subject", "label"],
    ["description", "detail", "body", "content", "notes"],
    ["team", "members", "people", "staff", "colleagues"],
    ["workflow", "process", "procedure", "guideline", "policy", "rule"],
]

# Map every synonym → its canonical form (first in group)
SYNONYM_MAP: dict[str, str] = {}
for group in SYNONYM_GROUPS:
    canonical = group[0]
    for word in group:
        SYNONYM_MAP[word] = canonical


def expand(token: str) -> str:
    """Return the canonical form of a token, or the token itself if not a synonym."""
    return SYNONYM_MAP.get(token, token)
