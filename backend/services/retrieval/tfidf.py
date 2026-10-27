import math
import re
from typing import Any
from .synonyms import expand


def tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split, expand synonyms."""
    tokens = re.sub(r"[^a-z0-9_\s]", " ", text.lower()).split()
    return [expand(t) for t in tokens if len(t) > 1]


def _tf(tokens: list[str], term: str) -> float:
    if not tokens:
        return 0.0
    return tokens.count(term) / len(tokens)


def _idf(tokenized_docs: list[list[str]], term: str, n_docs: int) -> float:
    docs_with_term = sum(1 for tokens in tokenized_docs if term in tokens)
    return math.log((n_docs + 1) / (docs_with_term + 1))


def _cosine(vec_a: list[float], vec_b: list[float]) -> float:
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a ** 2 for a in vec_a))
    norm_b = math.sqrt(sum(b ** 2 for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class TFIDFIndex:
    def __init__(self, documents: list[dict[str, Any]]):
        self.documents = documents
        self._tokenized = [tokenize(doc["content"]) for doc in documents]
        n = len(documents)

        # Build vocabulary
        self._vocab = list({t for tokens in self._tokenized for t in tokens})

        # Precompute IDF per term
        self._idf_cache = {
            term: _idf(self._tokenized, term, n) for term in self._vocab
        }

        # Precompute document TF-IDF vectors
        self._doc_vectors = [
            [_tf(tokens, term) * self._idf_cache[term] for term in self._vocab]
            for tokens in self._tokenized
        ]

    def query(self, query_text: str, top_k: int = 3) -> list[dict]:
        query_tokens = tokenize(query_text)
        query_vec = [
            _tf(query_tokens, term) * self._idf_cache.get(term, 0.0)
            for term in self._vocab
        ]

        scored = [
            {"document": self.documents[i], "score": _cosine(query_vec, self._doc_vectors[i])}
            for i in range(len(self.documents))
        ]
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]
