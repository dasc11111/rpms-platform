"""Domain events publicados por el contexto Workforce."""

from __future__ import annotations

import sys
from pathlib import Path

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import DomainEvent  # noqa: E402


def worker_created(*, tenant_id: str, worker_id: str, national_id: str) -> DomainEvent:
    return DomainEvent(
        name="workforce.worker.created.v1",
        tenant_id=tenant_id,
        payload={"worker_id": worker_id, "national_id": national_id},
    )


def worker_activated(
    *, tenant_id: str, worker_id: str, service_id: str, facility_id: str
) -> DomainEvent:
    return DomainEvent(
        name="workforce.worker.activated.v1",
        tenant_id=tenant_id,
        payload={
            "worker_id": worker_id,
            "service_id": service_id,
            "facility_id": facility_id,
        },
    )


def worker_suspended(*, tenant_id: str, worker_id: str, reason: str) -> DomainEvent:
    return DomainEvent(
        name="workforce.worker.suspended.v1",
        tenant_id=tenant_id,
        payload={"worker_id": worker_id, "reason": reason},
    )


def worker_reactivated(*, tenant_id: str, worker_id: str) -> DomainEvent:
    return DomainEvent(
        name="workforce.worker.reactivated.v1",
        tenant_id=tenant_id,
        payload={"worker_id": worker_id},
    )


def worker_terminated(*, tenant_id: str, worker_id: str) -> DomainEvent:
    return DomainEvent(
        name="workforce.worker.terminated.v1",
        tenant_id=tenant_id,
        payload={"worker_id": worker_id},
    )


def authorization_expiring_soon(
    *, tenant_id: str, worker_id: str, authorization_id: str, days_left: int
) -> DomainEvent:
    return DomainEvent(
        name="workforce.authorization.expiring_soon.v1",
        tenant_id=tenant_id,
        payload={
            "worker_id": worker_id,
            "authorization_id": authorization_id,
            "days_left": days_left,
        },
    )
