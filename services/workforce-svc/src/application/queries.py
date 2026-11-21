"""Queries (lado de lectura) del contexto Workforce.

Los queries devuelven DTOs planos optimizados para lectura. En una
implementación con CQRS completo, podrían leer de una proyección
denormalizada. En el MVP leemos directo del repositorio.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from typing import Optional

from ..domain import Worker
from .ports import UnitOfWork


@dataclass
class WorkerSummaryDTO:
    id: str
    national_id: str
    full_name: str
    profession: Optional[str]
    icrp_category: str
    status: str
    primary_service_id: Optional[str]
    primary_facility_id: Optional[str]

    @classmethod
    def from_worker(cls, w: Worker) -> "WorkerSummaryDTO":
        return cls(
            id=w.id,
            national_id=w.national_id.normalized,
            full_name=w.full_name,
            profession=w.profession,
            icrp_category=w.icrp_category.value,
            status=w.status.value,
            primary_service_id=w.primary_service_id,
            primary_facility_id=w.primary_facility_id,
        )

    def to_dict(self) -> dict:
        return asdict(self)


class GetWorker:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def __call__(self, tenant_id: str, worker_id: str) -> Optional[WorkerSummaryDTO]:
        with self.uow as uow:
            w = uow.workers.get(tenant_id, worker_id)
            return WorkerSummaryDTO.from_worker(w) if w else None


class ListActiveWorkers:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def __call__(
        self,
        tenant_id: str,
        service_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[WorkerSummaryDTO]:
        with self.uow as uow:
            workers = uow.workers.list_active(
                tenant_id, service_id=service_id, limit=limit, offset=offset
            )
            return [WorkerSummaryDTO.from_worker(w) for w in workers]


class CountActiveWorkers:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def __call__(self, tenant_id: str) -> int:
        with self.uow as uow:
            return uow.workers.count_active(tenant_id)


@dataclass
class ExpiringAuthorizationDTO:
    authorization_id: str
    worker_id: str
    worker_name: str
    authorization_type: str
    expires_at: str
    days_left: int


class ListExpiringAuthorizations:
    """Autorizaciones que vencen en los próximos N días."""

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def __call__(
        self, tenant_id: str, on_date: date, threshold_days: int = 90
    ) -> list[ExpiringAuthorizationDTO]:
        results: list[ExpiringAuthorizationDTO] = []
        with self.uow as uow:
            for auth in uow.authorizations.list_expiring(
                tenant_id, on_date, threshold_days
            ):
                worker = uow.workers.get(tenant_id, auth.worker_id)
                if worker is None:
                    continue
                days = auth.days_until_expiry(on_date)
                results.append(
                    ExpiringAuthorizationDTO(
                        authorization_id=auth.id,
                        worker_id=worker.id,
                        worker_name=worker.full_name,
                        authorization_type=auth.authorization_type.value,
                        expires_at=auth.expires_at.isoformat() if auth.expires_at else "",
                        days_left=days if days is not None else -1,
                    )
                )
        return results
