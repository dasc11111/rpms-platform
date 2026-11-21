"""Ports (interfaces / puertos) del contexto Workforce.

Los adaptadores en `infrastructure/` implementan estas interfaces.
El dominio y la aplicación solo dependen de estos protocolos.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, Protocol, Sequence

from ..domain import Authorization, Worker


class WorkerRepository(Protocol):
    def get(self, tenant_id: str, worker_id: str) -> Optional[Worker]: ...

    def get_by_national_id(
        self, tenant_id: str, national_id_value: str, country: str
    ) -> Optional[Worker]: ...

    def save(self, worker: Worker) -> None: ...

    def list_active(
        self,
        tenant_id: str,
        service_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Worker]: ...

    def count_active(self, tenant_id: str) -> int: ...


class AuthorizationRepository(Protocol):
    def save(self, authorization: Authorization) -> None: ...

    def get(self, tenant_id: str, authorization_id: str) -> Optional[Authorization]: ...

    def list_for_worker(
        self, tenant_id: str, worker_id: str
    ) -> Sequence[Authorization]: ...

    def list_expiring(
        self, tenant_id: str, on_date: date, threshold_days: int
    ) -> Sequence[Authorization]: ...


class UnitOfWork(Protocol):
    """Transacción atómica que abarca múltiples operaciones de repos."""

    workers: WorkerRepository
    authorizations: AuthorizationRepository

    def __enter__(self) -> "UnitOfWork": ...

    def __exit__(self, exc_type, exc, tb) -> None: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...
