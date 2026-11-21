"""Tests del document-svc."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_SVC = Path(__file__).resolve().parents[1]
_LIBS = Path(__file__).resolve().parents[3] / "libs" / "rpms-core"
sys.path.insert(0, str(_LIBS))
sys.path.insert(0, str(_SVC))

from rpms_core import EventBus, ValidationError  # noqa: E402

from src.application import DocumentIngestionPipeline, StubOCRProvider  # noqa: E402
from src.domain import (  # noqa: E402
    Document,
    DocumentType,
    DomainNER,
    EntityReconciler,
    ExtractedEntity,
    OCRStatus,
    ReconciliationCallbacks,
    SemanticIndex,
    classify_by_keywords,
    compute_sha256,
)


# =====================================================================
# Dominio Document
# =====================================================================


class TestDocument(unittest.TestCase):
    def _mk(self, **overrides):
        defaults = dict(
            tenant_id="t",
            original_filename="doc.pdf",
            sha256="a" * 64,
            size_bytes=1024,
            mime_type="application/pdf",
            storage_uri="s3://bucket/doc.pdf",
            uploaded_by="user-1",
        )
        defaults.update(overrides)
        return Document(**defaults)

    def test_sha256_must_be_64_chars(self):
        with self.assertRaises(ValidationError):
            self._mk(sha256="short")

    def test_negative_size_rejected(self):
        with self.assertRaises(ValidationError):
            self._mk(size_bytes=-1)

    def test_filename_required(self):
        with self.assertRaises(ValidationError):
            self._mk(original_filename="")

    def test_ocr_status_transitions(self):
        d = self._mk()
        self.assertEqual(d.ocr_status, OCRStatus.PENDING)
        d.mark_ocr_done(engine="tesseract", text="hola")
        self.assertEqual(d.ocr_status, OCRStatus.DONE)
        self.assertEqual(d.extracted_text, "hola")
        self.assertIsNotNone(d.ocr_completed_at)

    def test_ocr_failure_stores_reason(self):
        d = self._mk()
        d.mark_ocr_failed(engine="tesseract", reason="scan too dark")
        self.assertEqual(d.ocr_status, OCRStatus.FAILED)
        self.assertIn("ocr_failure_reason", d.extracted_metadata)

    def test_classification_confidence_range(self):
        d = self._mk()
        with self.assertRaises(ValidationError):
            d.set_classification(DocumentType.DT001_INSTRUMENT_CALIBRATION_CERT, 1.5)

    def test_worm_lock(self):
        d = self._mk()
        self.assertFalse(d.worm_locked)
        d.lock_worm()
        self.assertTrue(d.worm_locked)

    def test_compute_sha256(self):
        h = compute_sha256(b"hello world")
        self.assertEqual(len(h), 64)
        self.assertEqual(
            h,
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
        )


# =====================================================================
# Clasificador
# =====================================================================


class TestClassifier(unittest.TestCase):
    def test_dosimetry_report_detected(self):
        text = """
        INFORME DOSIMETRICO MENSUAL
        Proveedor: Landauer
        Período: JUNIO 2026
        Hp(10): 0.35 mSv
        Hp(0.07): 0.38 mSv
        """
        r = classify_by_keywords(text)
        self.assertEqual(r.document_type, DocumentType.DT002_MONTHLY_DOSIMETRY_REPORT)
        self.assertGreater(r.confidence, 0.5)

    def test_calibration_certificate_detected(self):
        text = """
        CERTIFICADO DE CALIBRACIÓN
        Laboratorio de Calibración acreditado
        Instrumento: cámara de ionización
        Trazabilidad metrológica: SIM
        Próxima calibración: 2027-04-15
        """
        r = classify_by_keywords(text)
        self.assertEqual(
            r.document_type, DocumentType.DT001_INSTRUMENT_CALIBRATION_CERT
        )
        self.assertGreater(r.confidence, 0.5)

    def test_authorization_detected(self):
        text = """
        SEREMI DE SALUD Región Metropolitana
        RESOLUCIÓN EXENTA N° 1234/2024
        Autoriza operador de equipo generador de radiaciones ionizantes
        conforme al DS 133/1984.
        """
        r = classify_by_keywords(text)
        self.assertEqual(
            r.document_type, DocumentType.DT003_OPERATION_AUTHORIZATION
        )

    def test_empty_text_returns_unknown(self):
        r = classify_by_keywords("")
        self.assertEqual(r.document_type, DocumentType.UNKNOWN)
        self.assertEqual(r.confidence, 0.0)

    def test_generic_text_returns_unknown(self):
        r = classify_by_keywords("Este es un texto sin contexto médico o técnico.")
        self.assertEqual(r.document_type, DocumentType.UNKNOWN)


# =====================================================================
# Extractor NER
# =====================================================================


class TestDomainNER(unittest.TestCase):
    def setUp(self):
        self.ner = DomainNER()

    def test_extract_valid_rut(self):
        text = "El trabajador Javiera Muñoz, RUT 17.245.892-0, categoría A."
        fields = self.ner.extract(text)
        ruts = [f for f in fields if f.field_type == "rut"]
        self.assertEqual(len(ruts), 1)
        self.assertEqual(ruts[0].normalized_value, "172458920")
        self.assertEqual(ruts[0].confidence, 1.0)

    def test_invalid_rut_low_confidence(self):
        text = "RUT: 17.245.892-9"  # DV incorrecto
        fields = self.ner.extract(text)
        ruts = [f for f in fields if f.field_type == "rut"]
        self.assertEqual(len(ruts), 1)
        self.assertLess(ruts[0].confidence, 0.5)

    def test_extract_resolution_number(self):
        text = "RESOLUCIÓN EXENTA N° 1234/2024 de la SEREMI"
        fields = self.ner.extract(text)
        res = [f for f in fields if f.field_type == "resolution_number"]
        self.assertEqual(len(res), 1)
        self.assertIn("1234", res[0].value)

    def test_extract_isotopes(self):
        text = "Fuente radiactiva de Ir-192, actividad 3.7 GBq. También Co-60."
        fields = self.ner.extract(text)
        isotopes = [f for f in fields if f.field_type == "isotope"]
        self.assertEqual(len(isotopes), 2)

    def test_extract_activity(self):
        text = "Actividad: 3.7 GBq, dosis: 25 mCi"
        fields = self.ner.extract(text)
        acts = [f for f in fields if f.field_type == "activity"]
        self.assertEqual(len(acts), 2)

    def test_extract_dates(self):
        text = "Emitido el 2024-03-15, vence el 15/03/2028."
        fields = self.ner.extract(text)
        dates = [f for f in fields if f.field_type == "date"]
        self.assertEqual(len(dates), 2)
        # Ambas normalizadas a ISO
        self.assertIn("2024-03-15", [d.normalized_value for d in dates])
        self.assertIn("2028-03-15", [d.normalized_value for d in dates])

    def test_extract_serial(self):
        text = "Equipo Varian TrueBeam. S/N: TB-45781"
        fields = self.ner.extract(text)
        serials = [f for f in fields if f.field_type == "serial"]
        self.assertEqual(len(serials), 1)
        self.assertEqual(serials[0].normalized_value, "TB45781")


# =====================================================================
# Reconciliador
# =====================================================================


class TestReconciler(unittest.TestCase):
    def test_rut_matched_to_worker(self):
        ner = DomainNER()
        callbacks = ReconciliationCallbacks(
            find_worker_by_national_id=lambda rut: "worker-uuid-1"
            if rut == "172458920" else None,
        )
        rec = EntityReconciler(callbacks)
        fields = ner.extract("Trabajador RUT 17.245.892-0")
        entities = rec.reconcile(fields)
        matches = [e for e in entities if e.matched_entity_id]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].matched_entity_id, "worker-uuid-1")
        self.assertEqual(matches[0].entity_type, "worker")

    def test_serial_matched_to_equipment(self):
        ner = DomainNER()
        callbacks = ReconciliationCallbacks(
            find_equipment_by_serial=lambda s: "eq-1" if s == "TB45781" else None,
        )
        rec = EntityReconciler(callbacks)
        fields = ner.extract("Equipo S/N: TB-45781")
        entities = rec.reconcile(fields)
        matches = [e for e in entities if e.matched_entity_id]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].entity_type, "equipment")

    def test_serial_falls_back_to_instrument(self):
        ner = DomainNER()
        callbacks = ReconciliationCallbacks(
            find_equipment_by_serial=lambda s: None,
            find_instrument_by_serial=lambda s: "inst-1" if s == "LM45678" else None,
        )
        rec = EntityReconciler(callbacks)
        fields = ner.extract("Instrumento Serial: LM-45678")
        entities = rec.reconcile(fields)
        matches = [e for e in entities if e.matched_entity_id]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].entity_type, "instrument")

    def test_unmatched_reduces_confidence(self):
        ner = DomainNER()
        callbacks = ReconciliationCallbacks(
            find_worker_by_national_id=lambda r: None,
        )
        rec = EntityReconciler(callbacks)
        fields = ner.extract("RUT 17.245.892-0")
        entities = rec.reconcile(fields)
        self.assertEqual(len(entities), 1)
        self.assertIsNone(entities[0].matched_entity_id)
        self.assertLess(entities[0].confidence, 1.0)


# =====================================================================
# Búsqueda semántica
# =====================================================================


class TestSemanticIndex(unittest.TestCase):
    def test_chunk_document(self):
        idx = SemanticIndex()
        text = "A" * 1200
        chunks = idx.chunk_document("doc-1", text, max_chars=500, overlap=50)
        self.assertGreater(len(chunks), 1)
        self.assertEqual(chunks[0].document_id, "doc-1")

    def test_search_returns_relevant_chunk(self):
        idx = SemanticIndex()
        chunks = [
            idx.chunk_document("d1", "El equipo Varian TrueBeam requiere calibración anual y control de calidad."),
            idx.chunk_document("d2", "La dosimetría personal usa dosímetros Landauer con lectura mensual Hp(10)."),
            idx.chunk_document("d3", "El blindaje de la sala usa muros de hormigón baritado y puerta plomada."),
        ]
        flat = [c for group in chunks for c in group]
        idx.build(flat)
        results = idx.search("dosímetro y lecturas mensuales", top_k=2)
        self.assertGreater(len(results), 0)
        # El chunk sobre dosimetría debe estar entre los top
        top_ids = [r.document_id for r in results[:2]]
        self.assertIn("d2", top_ids)

    def test_search_empty_index(self):
        idx = SemanticIndex()
        results = idx.search("cualquier consulta")
        self.assertEqual(results, [])


# =====================================================================
# Pipeline completo
# =====================================================================


class TestIngestionPipeline(unittest.TestCase):
    def test_full_pipeline_on_dosimetry_report(self):
        content = b"""
        INFORME DOSIMETRICO MENSUAL - LANDAUER
        Proveedor: Landauer
        Periodo: JUNIO 2026
        RUT: 17.245.892-0
        Trabajador: Javiera Munoz
        Hp(10): 0.35 mSv
        Hp(0.07): 0.38 mSv
        Fecha: 2026-06-30
        """
        ocr = StubOCRProvider(text=content.decode("utf-8"))
        callbacks = ReconciliationCallbacks(
            find_worker_by_national_id=lambda r: "worker-uuid-1"
            if r == "172458920" else None,
        )
        reconciler = EntityReconciler(callbacks)
        index = SemanticIndex()
        bus = EventBus()
        pipeline = DocumentIngestionPipeline(
            ocr=ocr, reconciler=reconciler, semantic_index=index, bus=bus,
        )

        result = pipeline.ingest(
            tenant_id="t1", content=content,
            original_filename="dosim-06-2026.pdf",
            mime_type="text/plain",
            uploaded_by="user-1",
            storage_uri="s3://bucket/dosim-06-2026.pdf",
        )

        doc = result.document
        self.assertEqual(doc.ocr_status, OCRStatus.DONE)
        self.assertEqual(doc.document_type, DocumentType.DT002_MONTHLY_DOSIMETRY_REPORT)
        self.assertGreater(doc.document_type_confidence, 0.3)

        # Debe haber vinculado al trabajador
        linked = [e for e in doc.related_entities if e.matched_entity_id]
        self.assertGreaterEqual(len(linked), 1)
        worker_link = next((e for e in linked if e.entity_type == "worker"), None)
        self.assertIsNotNone(worker_link)
        self.assertEqual(worker_link.matched_entity_id, "worker-uuid-1")

        # Debe haber generado chunks para indexado
        self.assertGreater(len(result.chunks), 0)

        # Debe haber publicado eventos del ciclo de vida
        event_names = [e.name for e in result.events]
        self.assertIn("document.uploaded.v1", event_names)
        self.assertIn("document.ocr.completed.v1", event_names)
        self.assertIn("document.classified.v1", event_names)
        self.assertIn("document.entities.extracted.v1", event_names)
        self.assertIn("document.indexed.v1", event_names)

    def test_pipeline_with_empty_ocr_result(self):
        ocr = StubOCRProvider(text="")
        callbacks = ReconciliationCallbacks()
        reconciler = EntityReconciler(callbacks)
        bus = EventBus()
        pipeline = DocumentIngestionPipeline(ocr=ocr, reconciler=reconciler, bus=bus)
        result = pipeline.ingest(
            tenant_id="t", content=b"binary-content-cannot-decode",
            original_filename="scanned.pdf",
            mime_type="application/pdf",  # No text/plain → usa stub que devuelve ""
            uploaded_by="u", storage_uri="s3://x",
        )
        self.assertEqual(result.document.ocr_status, OCRStatus.FAILED)


if __name__ == "__main__":
    unittest.main(verbosity=2)
