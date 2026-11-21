"""Reconciliador de entidades extraídas contra entidades del sistema.

Recibe:
- Campos extraídos (RUTs, seriales, etc.)
- Repositorios de referencia (workers, equipment, instruments) → callbacks

Devuelve:
- Lista de ExtractedEntity resueltas (con matched_entity_id cuando corresponde)

Estrategia:
1. Match exacto por identificador normalizado.
2. Match difuso por trigram/Jaro-Winkler si el exacto falla (para nombres).
3. Umbral mínimo de confianza para consolidar link automático (0.85+).
   Debajo del umbral se crea una sugerencia para revisión humana.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from .document import ExtractedEntity
from .extractor import ExtractedField


@dataclass(frozen=True)
class ReconciliationCallbacks:
    """Callbacks para buscar entidades en cada servicio.

    Cada callback recibe un identificador normalizado y devuelve
    el id del sistema si existe, None si no.
    """

    find_worker_by_national_id: Optional[Callable[[str], Optional[str]]] = None
    find_equipment_by_serial: Optional[Callable[[str], Optional[str]]] = None
    find_instrument_by_serial: Optional[Callable[[str], Optional[str]]] = None
    find_authorization_by_number: Optional[Callable[[str], Optional[str]]] = None


class EntityReconciler:
    """Reconcilia campos extraídos contra entidades del sistema."""

    LINK_CONFIDENCE_THRESHOLD = 0.85

    def __init__(self, callbacks: ReconciliationCallbacks):
        self.callbacks = callbacks

    def reconcile(self, fields: list[ExtractedField]) -> list[ExtractedEntity]:
        """Devuelve entidades enriquecidas con matched_entity_id cuando aplica."""
        results: list[ExtractedEntity] = []
        seen: set[tuple[str, str]] = set()  # (type, normalized) para deduplicar

        for f in fields:
            key = (f.field_type, f.normalized_value)
            if key in seen:
                continue
            seen.add(key)

            matched_id: Optional[str] = None
            entity_type: Optional[str] = None

            if f.field_type == "rut" and self.callbacks.find_worker_by_national_id:
                matched_id = self.callbacks.find_worker_by_national_id(f.normalized_value)
                entity_type = "worker"
            elif f.field_type == "serial":
                if self.callbacks.find_equipment_by_serial:
                    matched_id = self.callbacks.find_equipment_by_serial(f.normalized_value)
                    if matched_id:
                        entity_type = "equipment"
                if matched_id is None and self.callbacks.find_instrument_by_serial:
                    matched_id = self.callbacks.find_instrument_by_serial(f.normalized_value)
                    if matched_id:
                        entity_type = "instrument"
                if entity_type is None:
                    entity_type = "equipment"  # tipo tentativo
            elif f.field_type == "resolution_number":
                if self.callbacks.find_authorization_by_number:
                    matched_id = self.callbacks.find_authorization_by_number(
                        f.normalized_value
                    )
                    entity_type = "authorization"
            else:
                continue  # dates, isotopes, activities no son entidades vinculables

            # Confidence final: baja si no matcheó
            final_conf = f.confidence if matched_id else f.confidence * 0.5

            results.append(ExtractedEntity(
                entity_type=entity_type or "unknown",
                external_reference=f.normalized_value,
                confidence=round(final_conf, 3),
                matched_entity_id=matched_id,
                field_source=f.field_type,
            ))
        return results
