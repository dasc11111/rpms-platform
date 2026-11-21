"""Búsqueda semántica sobre chunks de documentos.

En producción: embeddings con sentence-transformers (multilingual-e5) o
Voyage AI, almacenados en pgvector con índice HNSW.

Aquí implementamos TF-IDF (scikit-learn) como stand-in que responde a
consultas semánticamente cercanas dentro de un mismo dominio de vocabulario.
La API de la clase se mantiene compatible con el reemplazo por embeddings.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DocumentChunk:
    """Fragmento de un documento indexable."""

    document_id: str
    chunk_index: int
    text: str
    page: Optional[int] = None


@dataclass(frozen=True)
class SearchResult:
    document_id: str
    chunk_index: int
    text: str
    score: float
    page: Optional[int] = None


class SemanticIndex:
    """Índice semántico con TF-IDF vectorizer.

    En un despliegue real esto se sustituye por:
    - Vectores densos (dim 768–1024) desde un modelo de embeddings
    - Almacenamiento en pgvector con índice HNSW
    - Consultas con `<->` (distancia coseno)
    """

    def __init__(self):
        self._vectorizer = None
        self._matrix = None
        self._chunks: list[DocumentChunk] = []

    def build(self, chunks: list[DocumentChunk]) -> None:
        """Construye/reconstruye el índice desde cero."""
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
        except ImportError:
            self._vectorizer = None
            self._chunks = chunks
            return

        self._chunks = list(chunks)
        if not chunks:
            self._vectorizer = None
            self._matrix = None
            return

        # Char-ngrams robustos a flexiones morfológicas del español
        # (dosímetro/dosímetros, lectura/lecturas, calibración/calibraciones)
        # Complementa con tokens word-level para captar términos técnicos completos.
        self._vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            lowercase=True,
            min_df=1,
            max_df=1.0,
        )
        self._matrix = self._vectorizer.fit_transform([c.text for c in chunks])

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        if not self._chunks:
            return []
        if self._vectorizer is None or self._matrix is None:
            # Fallback: matching por substring
            results = [
                SearchResult(
                    document_id=c.document_id,
                    chunk_index=c.chunk_index,
                    text=c.text,
                    score=1.0 if query.lower() in c.text.lower() else 0.0,
                    page=c.page,
                )
                for c in self._chunks
            ]
            return sorted([r for r in results if r.score > 0],
                          key=lambda r: r.score, reverse=True)[:top_k]

        from sklearn.metrics.pairwise import cosine_similarity
        q_vec = self._vectorizer.transform([query])
        similarities = cosine_similarity(q_vec, self._matrix).flatten()

        # Top-k índices
        top_indices = similarities.argsort()[-top_k:][::-1]
        results = []
        for i in top_indices:
            score = float(similarities[i])
            if score < 0.01:
                continue
            c = self._chunks[i]
            results.append(SearchResult(
                document_id=c.document_id,
                chunk_index=c.chunk_index,
                text=c.text,
                score=round(score, 4),
                page=c.page,
            ))
        return results

    def chunk_document(
        self, document_id: str, text: str,
        max_chars: int = 500,
        overlap: int = 50,
    ) -> list[DocumentChunk]:
        """Divide el texto en chunks solapados.

        Estrategia simple por caracteres. En producción se usa un splitter
        por oraciones/tokens que respete límites semánticos.
        """
        chunks: list[DocumentChunk] = []
        if not text:
            return chunks
        pos = 0
        idx = 0
        while pos < len(text):
            end = min(pos + max_chars, len(text))
            chunk_text = text[pos:end].strip()
            if chunk_text:
                chunks.append(DocumentChunk(
                    document_id=document_id,
                    chunk_index=idx,
                    text=chunk_text,
                ))
                idx += 1
            pos = end - overlap if end < len(text) else end
        return chunks
