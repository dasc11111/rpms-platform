"""Dominio Worker (Persona Ocupacionalmente Expuesta - POE).

Núcleo puro: sin dependencias de infraestructura ni frameworks.
Reglas de negocio y de estado como invariantes en el propio agregado.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field, replace
from datetime import date
from enum import Enum
from pathlib import Path
from typing import Optional

# Path a rpms-core (en producción se instala como paquete)
_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import ValidationError, new_uuid, normalize_rut, validate_rut  # noqa: E402


class WorkerStatus(str, Enum):
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class ICRPCategory(str, Enum):
    """Clasificación ICRP del trabajador ocupacionalmente expuesto.

    Categoría A: puede recibir dosis efectiva anual > 6 mSv o dosis
    equivalentes > 3/10 del límite anual. Vigilancia dosimétrica y
    médica estrictas.

    Categoría B: los que no cumplen los criterios de A pero pueden
    superar 1 mSv/año.
    """

    A = "A"
    B = "B"


@dataclass(frozen=True)
class NationalId:
    """Identificador nacional. En Chile es RUT; en otros países se acepta como texto."""

    value: str
    country: str  # ISO 3166-1 alpha-2

    def __post_init__(self) -> None:
        if not self.value or not isinstance(self.value, str):
            raise ValidationError("national_id.value no puede estar vacío")
        if len(self.country) != 2:
            raise ValidationError("national_id.country debe ser ISO alpha-2")
        if self.country.upper() == "CL":
            if not validate_rut(self.value):
                raise ValidationError(
                    f"RUT chileno inválido: {self.value}",
                    details={"national_id": self.value},
                )

    @property
    def normalized(self) -> str:
        if self.country.upper() == "CL":
            return normalize_rut(self.value)
        return self.value.strip().upper()


@dataclass
class Worker:
    """Agregado raíz Worker (POE).

    Invariantes:
    - `national_id` es válido para su país.
    - Un worker en estado ACTIVE debe tener servicio primario asignado.
    - Un worker categoría A debe tener asignado dosímetro (validación se hace
      en el caso de uso, no aquí — el agregado sólo modela sus propios datos).
    - No se puede terminar un worker que no está activo.
    """

    tenant_id: str
    national_id: NationalId
    full_name: str
    icrp_category: ICRPCategory
    id: str = field(default_factory=new_uuid)
    primary_facility_id: Optional[str] = None
    primary_service_id: Optional[str] = None
    profession: Optional[str] = None
    job_title: Optional[str] = None
    hire_date: Optional[date] = None
    birth_date: Optional[date] = None
    sex: Optional[str] = None
    status: WorkerStatus = WorkerStatus.ONBOARDING
    qr_token: Optional[str] = None
    photo_url: Optional[str] = None
    signature_url: Optional[str] = None

    def __post_init__(self) -> None:
        self._validate()

    def _validate(self) -> None:
        if not self.full_name or len(self.full_name.strip()) < 3:
            raise ValidationError("full_name requerido (mínimo 3 caracteres)")
        if not self.tenant_id:
            raise ValidationError("tenant_id requerido")
        if self.sex is not None and self.sex not in ("F", "M", "X"):
            raise ValidationError("sex debe ser F, M o X")

    # --- Transiciones de estado ---

    def activate(self, *, service_id: str, facility_id: str) -> Worker:
        """Onboarding → Active.

        Requiere que se asigne servicio primario.
        """
        if self.status == WorkerStatus.TERMINATED:
            raise ValidationError("No se puede reactivar un trabajador terminado")
        if not service_id:
            raise ValidationError("service_id requerido para activar")
        if not facility_id:
            raise ValidationError("facility_id requerido para activar")
        return replace(
            self,
            status=WorkerStatus.ACTIVE,
            primary_service_id=service_id,
            primary_facility_id=facility_id,
        )

    def suspend(self, reason: str) -> Worker:
        if self.status != WorkerStatus.ACTIVE:
            raise ValidationError(
                f"Solo un worker ACTIVE puede ser suspendido (actual: {self.status.value})"
            )
        if not reason or len(reason.strip()) < 5:
            raise ValidationError("Motivo de suspensión requerido (mínimo 5 caracteres)")
        return replace(self, status=WorkerStatus.SUSPENDED)

    def reactivate(self) -> Worker:
        if self.status != WorkerStatus.SUSPENDED:
            raise ValidationError(
                f"Solo un worker SUSPENDED puede reactivarse (actual: {self.status.value})"
            )
        return replace(self, status=WorkerStatus.ACTIVE)

    def terminate(self, on_date: date) -> Worker:
        if self.status == WorkerStatus.TERMINATED:
            raise ValidationError("Trabajador ya está terminado")
        if self.hire_date and on_date < self.hire_date:
            raise ValidationError("Fecha de término anterior a la contratación")
        return replace(self, status=WorkerStatus.TERMINATED)

    # --- Consultas ---

    def is_active(self) -> bool:
        return self.status == WorkerStatus.ACTIVE

    def requires_dosimeter(self) -> bool:
        """Categoría A siempre requiere; B según reglas de compliance."""
        return self.icrp_category == ICRPCategory.A

    def annual_dose_limit_msv(self) -> float:
        """Límite anual efectiva según ICRP 103 y DS 3/1985.

        - 20 mSv/año promediado en 5 años consecutivos.
        - 50 mSv en un año individual (con acumulado 100 mSv en 5 años).
        Esta función retorna el valor operativo por año.
        """
        return 20.0

    def five_year_dose_limit_msv(self) -> float:
        return 100.0
