"""Extractor de entidades nombradas específicas del dominio radiológico.

En producción: modelo NER fine-tuneado + LLM para inferencia. Aquí,
extracción determinista basada en regex para:
- RUTs (chilenos, con validación módulo 11)
- Números de serie de equipos (patrones habituales de fabricantes)
- Números de resolución exenta o autorización SEREMI
- Fechas en múltiples formatos
- Isótopos y actividades radiactivas
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import validate_rut, normalize_rut  # noqa: E402


@dataclass(frozen=True)
class ExtractedField:
    field_type: str  # "rut", "serial", "resolution_number", "date", "isotope", "activity"
    value: str
    normalized_value: str
    context: str  # snippet donde fue encontrado
    span: tuple[int, int]  # (start, end) en el texto original
    confidence: float


class DomainNER:
    """Named Entity Recognizer específico del dominio radiológico."""

    # Patrones
    _RUT_PATTERN = re.compile(
        r"(?<![\w-])(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])(?![\w-])"
    )
    _RESOLUTION_PATTERN = re.compile(
        r"resoluci[oó]n\s+(?:exenta\s+)?(?:n[°º]\s*)?(\d{1,6}[\s/-]?\d{2,4})",
        re.IGNORECASE,
    )
    _SERIAL_PATTERN = re.compile(
        r"(?:s/n|serial|serie|n[°º]\s+serie)[:\s]+([A-Z]{1,4}[-]?\d{2,10})",
        re.IGNORECASE,
    )
    _DATE_PATTERNS = [
        re.compile(r"\b(\d{4}-\d{2}-\d{2})\b"),
        re.compile(r"\b(\d{2}/\d{2}/\d{4})\b"),
        re.compile(r"\b(\d{2}-\d{2}-\d{4})\b"),
    ]
    _ISOTOPE_PATTERN = re.compile(
        r"\b(Ir-192|Co-60|Cs-137|I-131|F-18|Tc-99m?|Ga-68|Lu-177|Ra-226|Am-241|Sr-90|Y-90)\b",
        re.IGNORECASE,
    )
    _ACTIVITY_PATTERN = re.compile(
        r"(\d+(?:[.,]\d+)?)\s*(GBq|MBq|kBq|Bq|Ci|mCi|µCi|uCi|nCi)",
        re.IGNORECASE,
    )

    def extract(self, text: str) -> list[ExtractedField]:
        """Extrae todas las entidades del texto en un solo pase."""
        results: list[ExtractedField] = []

        # RUTs
        for m in self._RUT_PATTERN.finditer(text):
            raw = m.group(1)
            if validate_rut(raw):
                results.append(ExtractedField(
                    field_type="rut",
                    value=raw,
                    normalized_value=normalize_rut(raw),
                    context=self._snippet(text, m.start(), m.end()),
                    span=(m.start(), m.end()),
                    confidence=1.0,
                ))
            else:
                # RUT sintácticamente parecido pero DV inválido: baja confianza
                results.append(ExtractedField(
                    field_type="rut",
                    value=raw,
                    normalized_value=raw.replace(".", "").replace("-", "").upper(),
                    context=self._snippet(text, m.start(), m.end()),
                    span=(m.start(), m.end()),
                    confidence=0.3,
                ))

        # Números de resolución
        for m in self._RESOLUTION_PATTERN.finditer(text):
            raw = m.group(1)
            results.append(ExtractedField(
                field_type="resolution_number",
                value=raw,
                normalized_value=re.sub(r"[\s-]", "/", raw),
                context=self._snippet(text, m.start(), m.end()),
                span=(m.start(), m.end()),
                confidence=0.9,
            ))

        # Números de serie
        for m in self._SERIAL_PATTERN.finditer(text):
            raw = m.group(1)
            results.append(ExtractedField(
                field_type="serial",
                value=raw,
                normalized_value=raw.upper().replace("-", ""),
                context=self._snippet(text, m.start(), m.end()),
                span=(m.start(), m.end()),
                confidence=0.85,
            ))

        # Fechas
        for pat in self._DATE_PATTERNS:
            for m in pat.finditer(text):
                raw = m.group(1)
                normalized = self._normalize_date(raw)
                if normalized:
                    results.append(ExtractedField(
                        field_type="date",
                        value=raw,
                        normalized_value=normalized,
                        context=self._snippet(text, m.start(), m.end()),
                        span=(m.start(), m.end()),
                        confidence=0.95,
                    ))

        # Isótopos
        for m in self._ISOTOPE_PATTERN.finditer(text):
            raw = m.group(1)
            results.append(ExtractedField(
                field_type="isotope",
                value=raw,
                normalized_value=raw.title().replace("m", "m"),
                context=self._snippet(text, m.start(), m.end()),
                span=(m.start(), m.end()),
                confidence=0.98,
            ))

        # Actividades
        for m in self._ACTIVITY_PATTERN.finditer(text):
            raw = m.group(0)
            value, unit = m.group(1), m.group(2)
            normalized = f"{value.replace(',', '.')} {unit}"
            results.append(ExtractedField(
                field_type="activity",
                value=raw,
                normalized_value=normalized,
                context=self._snippet(text, m.start(), m.end()),
                span=(m.start(), m.end()),
                confidence=0.9,
            ))

        return results

    @staticmethod
    def _snippet(text: str, start: int, end: int, window: int = 40) -> str:
        a = max(0, start - window)
        b = min(len(text), end + window)
        return text[a:b].replace("\n", " ").strip()

    @staticmethod
    def _normalize_date(raw: str) -> str:
        """Devuelve ISO 8601 (YYYY-MM-DD) o cadena vacía si no se puede parsear."""
        from datetime import datetime as _dt
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return _dt.strptime(raw, fmt).date().isoformat()
            except ValueError:
                continue
        return ""
