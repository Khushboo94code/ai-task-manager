import os
from .tfidf import TFIDFIndex

DOCS_DIR = os.path.join(os.path.dirname(__file__), "docs")
RELEVANCE_THRESHOLD = 0.1

_index: TFIDFIndex | None = None
_documents: list[dict] = []


def _load_documents() -> list[dict]:
    docs = []
    for filename in sorted(os.listdir(DOCS_DIR)):
        if not filename.endswith(".md"):
            continue
        filepath = os.path.join(DOCS_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        doc_id = filename.replace(".md", "")
        # First line starting with # is the title
        first_line = content.strip().splitlines()[0]
        title = first_line.lstrip("#").strip() if first_line.startswith("#") else doc_id
        docs.append({"id": doc_id, "title": title, "content": content})
    return docs


def _get_index() -> TFIDFIndex:
    """Lazily build the index once on first use."""
    global _index, _documents
    if _index is None:
        _documents = _load_documents()
        _index = TFIDFIndex(_documents)
    return _index


def search(query: str, top_k: int = 3) -> list[dict]:
    """Return top_k docs scored by TF-IDF cosine similarity."""
    index = _get_index()
    raw = index.query(query, top_k=top_k)
    results = []
    for r in raw:
        doc = r["document"]
        # Snippet: first 200 chars of content (skip the title line)
        lines = doc["content"].strip().splitlines()
        body_lines = [l for l in lines if not l.startswith("#")]
        snippet = " ".join(body_lines).strip()[:200]
        results.append({
            "docId": doc["id"],
            "title": doc["title"],
            "score": round(r["score"], 4),
            "snippet": snippet,
            "content": doc["content"],
        })
    return results


def get_above_threshold(
    results: list[dict], threshold: float = RELEVANCE_THRESHOLD
) -> list[dict]:
    """Filter to only results with score >= threshold."""
    return [r for r in results if r["score"] >= threshold]
