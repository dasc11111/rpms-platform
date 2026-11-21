"""Schemas de request/response de la API HTTP.

Definidos como dataclasses para no depender de Pydantic en el sandbox.
En producción se reemplazan por `pydantic.BaseModel` con validaciones
más ricas.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Optional


@dataclass
class CreateWorkerRequest:
    tenant_id: str
    national_id: str
    national_id_country: str
    full_name: str
    icrp_category: str
    profession: Optional[str] = None
    job_title: Optional[str] = None
    hire_date: Optional[str] = None  # ISO-8601
    sex: Optional[str] = None

    def parsed_hire_date(self) -> Optional[date]:
        if not self.hire_date:
            return None
        return date.fromisoformat(self.hire_date)


@dataclass
class ActivateWorkerRequest:
    service_id: str
    facility_id: str


@dataclass
class SuspendWorkerRequest:
    reason: str


@dataclass
class WorkerResponse:
    id: str
    national_id: str
    full_name: str
    profession: Optional[str]
    icrp_category: str
    status: str
    primary_service_id: Optional[str]
    primary_facility_id: Optional[str]

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ProblemDetails:
    """RFC 7807 Problem Details for HTTP APIs."""

    type: str
    title: str
    status: int
    detail: str
    code: str
    errors: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v or k == "status"}
