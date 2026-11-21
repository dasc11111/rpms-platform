"""Parsers de reportes de proveedores dosimétricos.

Soporta un formato genérico CSV/TSV con columnas mínimas y adaptadores
por proveedor cuando el formato es específico. Todo el parseo devuelve
`RawDosimetryRecord` que luego se reconcilia con el modelo de dominio.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import date
from typing import Iterable, Optional


@dataclass
class RawDosimetryRecord:
    """Registro crudo tal como viene del proveedor, sin resolver entidades."""

    row_number: int
    worker_national_id: Optional[str]
    worker_full_name: Optional[str]
    dosimeter_code: Optional[str]
    period_start: Optional[date]
    period_end: Optional[date]
    hp10_msv: Optional[float]
    hp007_msv: Optional[float]
    hp3_msv: Optional[float]
    neutron_msv: Optional[float]
    provider_report_id: Optional[str] = None
    raw: dict = None
    parse_errors: list[str] = None


def _parse_date_flex(s: str) -> Optional[date]:
    if s is None or s == "":
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y%m%d", "%m/%Y", "%Y-%m"):
        try:
            from datetime import datetime as _dt
            return _dt.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(s: str) -> Optional[float]:
    if s is None or s == "":
        return None
    s = s.strip().replace(",", ".")
    # LTR = "Less Than Reportable" — típico en dosimetría
    if s.upper() in ("LTR", "M", "MDA", "<MDA", "<LDD", "N/D", "ND"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


# Sinónimos de columnas por idioma y proveedor
_COLUMN_ALIASES = {
    "worker_national_id": ["rut", "national_id", "id_number", "cedula", "documento", "dni"],
    "worker_full_name": ["nombre", "worker_name", "full_name", "trabajador", "nombre_completo"],
    "dosimeter_code": ["dosimeter", "codigo_dosimetro", "dosimeter_code", "codigo", "badge", "codigo_ldr"],
    "period_start": ["periodo_inicio", "period_start", "inicio", "desde", "start"],
    "period_end": ["periodo_fin", "period_end", "fin", "hasta", "end"],
    "hp10_msv": ["hp10", "hp_10", "hp(10)", "dosis_profunda", "deep_dose", "hp(10)_msv", "hp10_msv"],
    "hp007_msv": ["hp007", "hp_007", "hp(0.07)", "dosis_superficial", "shallow_dose", "hp007_msv"],
    "hp3_msv": ["hp3", "hp_3", "hp(3)", "dosis_cristalino", "lens_dose", "hp3_msv"],
    "neutron_msv": ["neutron", "neutrones", "neutron_dose", "neutron_msv"],
    "provider_report_id": ["report_id", "reporte", "numero_reporte", "provider_report_id"],
}


def _normalize_key(k: str) -> str:
    return re.sub(r"[^a-z0-9]", "_", k.strip().lower()).strip("_")


def _map_columns(headers: list[str]) -> dict[str, Optional[int]]:
    """Devuelve un diccionario {campo_dominio: índice_columna}."""
    normalized = [_normalize_key(h) for h in headers]
    mapping: dict[str, Optional[int]] = {k: None for k in _COLUMN_ALIASES}
    for field, aliases in _COLUMN_ALIASES.items():
        for alias in aliases:
            a = _normalize_key(alias)
            if a in normalized:
                mapping[field] = normalized.index(a)
                break
    return mapping


def parse_generic_csv(
    content: str,
    delimiter: str = ",",
    provider_report_id: Optional[str] = None,
) -> Iterable[RawDosimetryRecord]:
    """Parsea un CSV genérico con auto-detección de columnas."""
    # Auto-detección de delimitador si es genérico y falla el default
    if delimiter == ",":
        first_line = content.splitlines()[0] if content else ""
        if first_line.count(";") > first_line.count(","):
            delimiter = ";"
        elif first_line.count("\t") > first_line.count(","):
            delimiter = "\t"

    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        return
    headers = rows[0]
    col_map = _map_columns(headers)

    for i, row in enumerate(rows[1:], start=2):
        if not any(cell.strip() for cell in row):
            continue  # línea vacía

        raw_dict = dict(zip(headers, row))
        errors: list[str] = []

        def col(name: str) -> Optional[str]:
            idx = col_map.get(name)
            if idx is None or idx >= len(row):
                return None
            return row[idx].strip() if row[idx] else None

        rut = col("worker_national_id")
        if col_map["worker_national_id"] is None:
            errors.append("Falta columna de identificador nacional")
        hp10 = _parse_float(col("hp10_msv") or "")
        if col_map["hp10_msv"] is None:
            errors.append("Falta columna Hp(10)")

        rec = RawDosimetryRecord(
            row_number=i,
            worker_national_id=rut,
            worker_full_name=col("worker_full_name"),
            dosimeter_code=col("dosimeter_code"),
            period_start=_parse_date_flex(col("period_start") or ""),
            period_end=_parse_date_flex(col("period_end") or ""),
            hp10_msv=hp10,
            hp007_msv=_parse_float(col("hp007_msv") or ""),
            hp3_msv=_parse_float(col("hp3_msv") or ""),
            neutron_msv=_parse_float(col("neutron_msv") or ""),
            provider_report_id=col("provider_report_id") or provider_report_id,
            raw=raw_dict,
            parse_errors=errors or None,
        )
        yield rec


def parse_landauer_csv(content: str, provider_report_id: str) -> Iterable[RawDosimetryRecord]:
    """Wrapper para el formato Landauer (delimiter tab, columnas específicas)."""
    return parse_generic_csv(content, delimiter="\t", provider_report_id=provider_report_id)
