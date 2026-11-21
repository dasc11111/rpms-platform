"""Dominio de Dosimetría.

Modela lecturas dosimétricas individuales y agregados temporales conforme
a ICRP 60/103 y la normativa chilena (DS 3/1985).

Magnitudes operativas manejadas:
- Hp(10): dosis equivalente profunda, mSv (cuerpo entero).
- Hp(0.07): dosis equivalente superficial, mSv (piel).
- Hp(3): dosis equivalente al cristalino, mSv.
- Componente neutrones (mSv) cuando aplica.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional, Sequence

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import ValidationError, new_uuid  # noqa: E402


@dataclass(frozen=True)
class DoseReading:
    """Lectura dosimétrica individual, mensual típicamente."""

    tenant_id: str
    worker_id: str
    dosimeter_id: str
    period_start: date
    period_end: date
    hp10_msv: Optional[float] = None
    hp007_msv: Optional[float] = None
    hp3_msv: Optional[float] = None
    neutron_msv: Optional[float] = None
    provider_report_id: Optional[str] = None
    id: str = field(default_factory=new_uuid)
    time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_anomaly: bool = False
    anomaly_reason: Optional[str] = None
    imported_from: Optional[str] = None

    def __post_init__(self) -> None:
        if self.period_end < self.period_start:
            raise ValidationError("period_end anterior a period_start")
        for name in ("hp10_msv", "hp007_msv", "hp3_msv", "neutron_msv"):
            v = getattr(self, name)
            if v is not None and v < 0:
                raise ValidationError(f"{name} no puede ser negativo")

    @property
    def effective_dose_msv(self) -> float:
        """Aproximación conservadora: Hp(10) es el mejor estimador de dosis efectiva.

        Para trabajadores con exposición neutrónica se suma la componente.
        """
        e = self.hp10_msv or 0.0
        if self.neutron_msv:
            e += self.neutron_msv
        return round(e, 4)


@dataclass(frozen=True)
class DoseSummary:
    """Suma de dosis en un período."""

    worker_id: str
    period_label: str  # "2026-06", "2026", "2022-2026"
    period_start: date
    period_end: date
    hp10_msv_sum: float
    hp007_msv_sum: float
    hp3_msv_sum: float
    neutron_msv_sum: float
    reading_count: int
    has_anomaly: bool

    @property
    def effective_dose_msv(self) -> float:
        return round(self.hp10_msv_sum + self.neutron_msv_sum, 4)


class ICRPLimits:
    """Límites recomendados por ICRP 103 (equivalentes en DS 3/1985 Chile).

    Trabajadores expuestos, dosis efectiva:
    - 20 mSv/año promediados en 5 años consecutivos.
    - 50 mSv máximo en un año individual.
    - Acumulado 5 años: 100 mSv.

    Dosis equivalentes anuales:
    - Cristalino: 20 mSv/año promediado, 50 mSv/año individual (ICRP 118).
    - Piel: 500 mSv/año.
    - Extremidades: 500 mSv/año.

    Umbrales operativos de investigación (buenas prácticas):
    - 30% del límite mensual (~0.5 mSv Hp(10)/mes) → nivel de registro.
    - 50% del límite anual (~10 mSv Hp(10)) → nivel de investigación.
    - 100% del límite → nivel de intervención inmediata.
    """

    EFFECTIVE_ANNUAL_LIMIT_MSV = 20.0
    EFFECTIVE_5YEAR_LIMIT_MSV = 100.0
    EFFECTIVE_SINGLE_YEAR_MAX_MSV = 50.0

    LENS_ANNUAL_LIMIT_MSV = 20.0
    SKIN_ANNUAL_LIMIT_MSV = 500.0
    EXTREMITY_ANNUAL_LIMIT_MSV = 500.0

    INVESTIGATION_LEVEL_FRACTION = 0.50
    INTERVENTION_LEVEL_FRACTION = 1.00

    @classmethod
    def investigation_level_msv(cls) -> float:
        return cls.EFFECTIVE_ANNUAL_LIMIT_MSV * cls.INVESTIGATION_LEVEL_FRACTION

    @classmethod
    def evaluate_annual(cls, summary: DoseSummary) -> tuple[str, str]:
        """Devuelve (nivel, mensaje) evaluando un resumen anual."""
        e = summary.effective_dose_msv
        if e >= cls.EFFECTIVE_ANNUAL_LIMIT_MSV:
            return "exceeded", (
                f"Dosis efectiva anual {e} mSv excede el límite ICRP "
                f"({cls.EFFECTIVE_ANNUAL_LIMIT_MSV} mSv/año)"
            )
        if e >= cls.investigation_level_msv():
            return "investigation", (
                f"Dosis efectiva anual {e} mSv supera el nivel de investigación "
                f"({cls.investigation_level_msv()} mSv = 50% del límite)"
            )
        if e >= 3.0:
            return "notification", f"Dosis efectiva anual {e} mSv — sobre nivel de notificación"
        return "normal", f"Dosis efectiva anual {e} mSv dentro de parámetros normales"


# =====================================================================
# Funciones puras de agregación
# =====================================================================


def summarize_period(
    readings: Sequence[DoseReading],
    worker_id: str,
    period_start: date,
    period_end: date,
    label: str,
) -> DoseSummary:
    """Suma lecturas dentro de un período. Función pura, sin efectos."""
    hp10 = hp007 = hp3 = neu = 0.0
    count = 0
    has_anomaly = False
    for r in readings:
        if r.worker_id != worker_id:
            continue
        if r.period_end < period_start or r.period_start > period_end:
            continue
        hp10 += r.hp10_msv or 0
        hp007 += r.hp007_msv or 0
        hp3 += r.hp3_msv or 0
        neu += r.neutron_msv or 0
        count += 1
        if r.is_anomaly:
            has_anomaly = True
    return DoseSummary(
        worker_id=worker_id,
        period_label=label,
        period_start=period_start,
        period_end=period_end,
        hp10_msv_sum=round(hp10, 4),
        hp007_msv_sum=round(hp007, 4),
        hp3_msv_sum=round(hp3, 4),
        neutron_msv_sum=round(neu, 4),
        reading_count=count,
        has_anomaly=has_anomaly,
    )


def annual_summary(
    readings: Sequence[DoseReading], worker_id: str, year: int
) -> DoseSummary:
    return summarize_period(
        readings,
        worker_id,
        period_start=date(year, 1, 1),
        period_end=date(year, 12, 31),
        label=str(year),
    )


def five_year_summary(
    readings: Sequence[DoseReading], worker_id: str, end_year: int
) -> DoseSummary:
    return summarize_period(
        readings,
        worker_id,
        period_start=date(end_year - 4, 1, 1),
        period_end=date(end_year, 12, 31),
        label=f"{end_year - 4}-{end_year}",
    )
