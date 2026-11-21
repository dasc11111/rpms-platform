"""Dominio de Documentos.

Un Document atraviesa un pipeline de estados:
    uploaded → ocr_processing → classified → entities_extracted → linked → ready

Cada transición es explícita y se registra en la propia entidad.
"""

from __future__ import annotations

import hashlib
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import ValidationError, new_uuid  # noqa: E402


class OCRStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class DocumentType(str, Enum):
    """Tipos documentales del catálogo (extensible por tenant)."""

    DT001_INSTRUMENT_CALIBRATION_CERT = "DT001"
    DT002_MONTHLY_DOSIMETRY_REPORT = "DT002"
    DT003_OPERATION_AUTHORIZATION = "DT003"
    DT004_FACILITY_LICENSE = "DT004"
    DT005_SHIELDING_BLUEPRINT = "DT005"
    DT006_SHIELDING_CALCULATION = "DT006"
    DT007_TRAINING_CERTIFICATE = "DT007"
    DT008_MEDICAL_EXAM = "DT008"
    DT009_INCIDENT_REPORT = "DT009"
    DT010_EQUIPMENT_QA_REPORT = "DT010"
    DT011_SOURCE_CERTIFICATE = "DT011"
    DT012_RADIOPHARMACEUTICAL_INVOICE = "DT012"
    DT013_REGULATORY_INSPECTION_ACT = "DT013"
    DT014_EQUIPMENT_MANUAL = "DT014"
    DT015_VENDOR_CONTRACT = "DT015"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class ExtractedEntity:
    """Entidad candidata a vincular con una entidad del sistema."""

    entity_type: str  # "worker" | "equipment" | "instrument" | "facility"
    external_reference: str  # RUT, serial, número resolución
    confidence: float
    matched_entity_id: Optional[str] = None
    field_source: Optional[str] = None  # dónde se encontró


@dataclass
class Document:
    tenant_id: str
    original_filename: str
    sha256: str
    size_bytes: int
    mime_type: str
    storage_uri: str
    uploaded_by: str
    id: str = field(default_factory=new_uuid)
    version: int = 1
    parent_document_id: Optional[str] = None
    worm_locked: bool = False
    uploaded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ocr_status: OCRStatus = OCRStatus.PENDING
    ocr_engine: Optional[str] = None
    ocr_completed_at: Optional[datetime] = None
    document_type: Optional[DocumentType] = None
    document_type_confidence: Optional[float] = None
    extracted_metadata: dict = field(default_factory=dict)
    related_entities: list[ExtractedEntity] = field(default_factory=list)
    extracted_text: Optional[str] = None  # texto plano extraído (no siempre persistido)

    def __post_init__(self) -> None:
        if not self.sha256 or len(self.sha256) != 64:
            raise ValidationError("sha256 debe tener 64 caracteres hex")
        if self.size_bytes < 0:
            raise ValidationError("size_bytes no puede ser negativo")
        if not self.original_filename:
            raise ValidationError("original_filename requerido")

    def mark_ocr_done(self, engine: str, text: str) -> None:
        self.ocr_status = OCRStatus.DONE
        self.ocr_engine = engine
        self.ocr_completed_at = datetime.now(timezone.utc)
        self.extracted_text = text

    def mark_ocr_failed(self, engine: str, reason: str) -> None:
        self.ocr_status = OCRStatus.FAILED
        self.ocr_engine = engine
        self.extracted_metadata["ocr_failure_reason"] = reason

    def set_classification(self, doc_type: DocumentType, confidence: float) -> None:
        if not 0 <= confidence <= 1:
            raise ValidationError("confidence debe estar en [0, 1]")
        self.document_type = doc_type
        self.document_type_confidence = confidence

    def add_entity(self, entity: ExtractedEntity) -> None:
        self.related_entities.append(entity)

    def lock_worm(self) -> None:
        """Cierra el documento en modo WORM (Write Once, Read Many)."""
        self.worm_locked = True


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
