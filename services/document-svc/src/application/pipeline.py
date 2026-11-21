"""Pipeline de ingesta documental.

Orquesta: upload → hash → OCR → clasificación → extracción → reconciliación → indexado.

Cada paso es opcional: si OCR ya fue hecho (documento nativo digital),
se salta. Cada paso publica un evento para observabilidad.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import DomainEvent, EventBus  # noqa: E402

from ..domain.classifier import classify_by_keywords
from ..domain.document import Document, DocumentType, OCRStatus, compute_sha256
from ..domain.extractor import DomainNER
from ..domain.reconciler import EntityReconciler, ReconciliationCallbacks
from ..domain.semantic_index import DocumentChunk, SemanticIndex


@dataclass
class IngestionResult:
    document: Document
    chunks: list[DocumentChunk]
    events: list[DomainEvent]


class OCRProvider:
    """Puerto: proveedor de OCR.

    En producción: AWS Textract, Google Document AI o Tesseract server.
    En tests: se inyecta un stub que devuelve el texto ya conocido.
    """

    def extract_text(self, content: bytes, mime_type: str) -> tuple[str, str]:
        """Devuelve (texto_extraído, engine_name)."""
        raise NotImplementedError


class StubOCRProvider(OCRProvider):
    """Stub que devuelve el texto que se le pase en el constructor."""

    def __init__(self, text: str, engine: str = "stub-ocr"):
        self.text = text
        self.engine = engine

    def extract_text(self, content: bytes, mime_type: str) -> tuple[str, str]:
        # Si el mime es text/plain o markdown, devolvemos el content decodificado
        if mime_type.startswith("text/"):
            try:
                return content.decode("utf-8"), self.engine
            except UnicodeDecodeError:
                pass
        return self.text, self.engine


class DocumentIngestionPipeline:
    """Pipeline configurable de ingesta documental."""

    def __init__(
        self,
        *,
        ocr: OCRProvider,
        reconciler: EntityReconciler,
        semantic_index: Optional[SemanticIndex] = None,
        bus: Optional[EventBus] = None,
    ):
        self.ocr = ocr
        self.reconciler = reconciler
        self.semantic_index = semantic_index
        self.bus = bus or EventBus()
        self.ner = DomainNER()

    def ingest(
        self,
        *,
        tenant_id: str,
        content: bytes,
        original_filename: str,
        mime_type: str,
        uploaded_by: str,
        storage_uri: str,
    ) -> IngestionResult:
        events: list[DomainEvent] = []

        # 1. Hash
        sha = compute_sha256(content)
        doc = Document(
            tenant_id=tenant_id,
            original_filename=original_filename,
            sha256=sha,
            size_bytes=len(content),
            mime_type=mime_type,
            storage_uri=storage_uri,
            uploaded_by=uploaded_by,
        )
        events.append(DomainEvent(
            name="document.uploaded.v1",
            tenant_id=tenant_id,
            payload={"document_id": doc.id, "filename": original_filename, "sha256": sha},
        ))

        # 2. OCR
        text, engine = self.ocr.extract_text(content, mime_type)
        if text:
            doc.mark_ocr_done(engine=engine, text=text)
            events.append(DomainEvent(
                name="document.ocr.completed.v1",
                tenant_id=tenant_id,
                payload={"document_id": doc.id, "engine": engine, "chars": len(text)},
            ))
        else:
            doc.mark_ocr_failed(engine=engine, reason="empty output")
            events.append(DomainEvent(
                name="document.ocr.failed.v1",
                tenant_id=tenant_id,
                payload={"document_id": doc.id, "engine": engine},
            ))
            for ev in events:
                self.bus.publish(ev)
            return IngestionResult(document=doc, chunks=[], events=events)

        # 3. Clasificación
        classification = classify_by_keywords(text)
        doc.set_classification(classification.document_type, classification.confidence)
        events.append(DomainEvent(
            name="document.classified.v1",
            tenant_id=tenant_id,
            payload={
                "document_id": doc.id,
                "document_type": classification.document_type.value,
                "confidence": classification.confidence,
            },
        ))

        # 4. Extracción NER
        extracted_fields = self.ner.extract(text)
        # 5. Reconciliación
        entities = self.reconciler.reconcile(extracted_fields)
        for e in entities:
            doc.add_entity(e)
        events.append(DomainEvent(
            name="document.entities.extracted.v1",
            tenant_id=tenant_id,
            payload={
                "document_id": doc.id,
                "extracted_fields_count": len(extracted_fields),
                "linked_entities_count": sum(1 for e in entities if e.matched_entity_id),
            },
        ))

        # 6. Chunking y indexado semántico
        chunks: list[DocumentChunk] = []
        if self.semantic_index is not None:
            chunks = self.semantic_index.chunk_document(doc.id, text)
            events.append(DomainEvent(
                name="document.indexed.v1",
                tenant_id=tenant_id,
                payload={"document_id": doc.id, "chunks_count": len(chunks)},
            ))

        # Publicar todos los eventos
        for ev in events:
            self.bus.publish(ev)

        return IngestionResult(document=doc, chunks=chunks, events=events)
