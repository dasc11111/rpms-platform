"""Entidad Authorization — autorización individual del trabajador POE.

Ejemplos: OPR titular, operador de LINAC, radiofarmaceuta, etc.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from pathlib import Path
from typing import Optional

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import ValidationError, new_uuid  # noqa: E402


class AuthorizationType(str, Enum):
    OPERATOR = "operator"
    OPR = "opr"
    OPR_ALTERNATE = "opr_alternate"
    MEDICAL_PHYSICIST = "medical_physicist"
    RADIOPHARMACIST = "radiopharmacist"
    SOURCE_CARRIER = "source_carrier"
    OTHER = "other"


class AuthorizationStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


@dataclass
class Authorization:
    tenant_id: str
    worker_id: str
    authorization_type: AuthorizationType
    issued_by: str  # ej: "SEREMI de Salud RM"
    issued_at: date
    id: str = field(default_factory=new_uuid)
    scope: list[str] = field(default_factory=list)
    expires_at: Optional[date] = None
    document_id: Optional[str] = None
    number: Optional[str] = None
    status: AuthorizationStatus = AuthorizationStatus.ACTIVE

    def __post_init__(self) -> None:
        if not self.issued_by:
            raise ValidationError("issued_by requerido")
        if self.expires_at and self.expires_at <= self.issued_at:
            raise ValidationError("expires_at debe ser posterior a issued_at")

    def is_valid_on(self, on_date: date) -> bool:
        if self.status != AuthorizationStatus.ACTIVE:
            return False
        if on_date < self.issued_at:
            return False
        if self.expires_at and on_date > self.expires_at:
            return False
        return True

    def days_until_expiry(self, from_date: date) -> Optional[int]:
        if self.expires_at is None:
            return None
        return (self.expires_at - from_date).days

    def is_expiring_soon(self, from_date: date, threshold_days: int = 90) -> bool:
        d = self.days_until_expiry(from_date)
        return d is not None and 0 <= d <= threshold_days
