"""Casos de uso (commands) del contexto Workforce.

Cada caso de uso:
1. Recibe un DTO de entrada tipado.
2. Carga agregados vía repositorios.
3. Aplica reglas de dominio.
4. Persiste y publica eventos.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import (  # noqa: E402
    Clock,
    ConflictError,
    EventBus,
    NotFoundError,
    ValidationError,
)

from ..domain import ICRPCategory, NationalId, Worker, WorkerStatus
from ..domain.events import (
    worker_activated,
    worker_created,
    worker_reactivated,
    worker_suspended,
    worker_terminated,
)
from .ports import UnitOfWork


# =====================================================================
# CreateWorker
# =====================================================================
@dataclass
class CreateWorkerCommand:
    tenant_id: str
    national_id: str
    national_id_country: str
    full_name: str
    icrp_category: str  # "A" | "B"
    profession: Optional[str] = None
    job_title: Optional[str] = None
    hire_date: Optional[date] = None
    sex: Optional[str] = None


class CreateWorker:
    """Crea un trabajador en estado ONBOARDING.

    Reglas:
    - No debe existir otro trabajador con mismo (tenant, national_id, country).
    - RUT chileno validado por módulo 11 en el value object.
    """

    def __init__(self, uow: UnitOfWork, bus: EventBus, clock: Clock):
        self.uow = uow
        self.bus = bus
        self.clock = clock

    def __call__(self, cmd: CreateWorkerCommand) -> Worker:
        national_id = NationalId(value=cmd.national_id, country=cmd.national_id_country)
        try:
            category = ICRPCategory(cmd.icrp_category)
        except ValueError:
            raise ValidationError(
                f"icrp_category inválida: {cmd.icrp_category}",
                details={"allowed": ["A", "B"]},
            )

        with self.uow as uow:
            existing = uow.workers.get_by_national_id(
                cmd.tenant_id, national_id.normalized, national_id.country
            )
            if existing:
                raise ConflictError(
                    "Trabajador ya existe con ese documento de identidad",
                    details={"national_id": national_id.value, "existing_id": existing.id},
                )

            worker = Worker(
                tenant_id=cmd.tenant_id,
                national_id=national_id,
                full_name=cmd.full_name,
                icrp_category=category,
                profession=cmd.profession,
                job_title=cmd.job_title,
                hire_date=cmd.hire_date,
                sex=cmd.sex,
                qr_token=f"QR-{national_id.normalized}",
            )
            uow.workers.save(worker)
            uow.commit()

        self.bus.publish(
            worker_created(
                tenant_id=worker.tenant_id,
                worker_id=worker.id,
                national_id=national_id.normalized,
            )
        )
        return worker


# =====================================================================
# ActivateWorker
# =====================================================================
@dataclass
class ActivateWorkerCommand:
    tenant_id: str
    worker_id: str
    service_id: str
    facility_id: str


class ActivateWorker:
    def __init__(self, uow: UnitOfWork, bus: EventBus):
        self.uow = uow
        self.bus = bus

    def __call__(self, cmd: ActivateWorkerCommand) -> Worker:
        with self.uow as uow:
            worker = uow.workers.get(cmd.tenant_id, cmd.worker_id)
            if worker is None:
                raise NotFoundError(f"Worker {cmd.worker_id} no encontrado")
            worker = worker.activate(
                service_id=cmd.service_id, facility_id=cmd.facility_id
            )
            uow.workers.save(worker)
            uow.commit()
        self.bus.publish(
            worker_activated(
                tenant_id=worker.tenant_id,
                worker_id=worker.id,
                service_id=cmd.service_id,
                facility_id=cmd.facility_id,
            )
        )
        return worker


# =====================================================================
# SuspendWorker
# =====================================================================
@dataclass
class SuspendWorkerCommand:
    tenant_id: str
    worker_id: str
    reason: str


class SuspendWorker:
    def __init__(self, uow: UnitOfWork, bus: EventBus):
        self.uow = uow
        self.bus = bus

    def __call__(self, cmd: SuspendWorkerCommand) -> Worker:
        with self.uow as uow:
            worker = uow.workers.get(cmd.tenant_id, cmd.worker_id)
            if worker is None:
                raise NotFoundError(f"Worker {cmd.worker_id} no encontrado")
            worker = worker.suspend(cmd.reason)
            uow.workers.save(worker)
            uow.commit()
        self.bus.publish(
            worker_suspended(
                tenant_id=worker.tenant_id,
                worker_id=worker.id,
                reason=cmd.reason,
            )
        )
        return worker


# =====================================================================
# ReactivateWorker
# =====================================================================
@dataclass
class ReactivateWorkerCommand:
    tenant_id: str
    worker_id: str


class ReactivateWorker:
    def __init__(self, uow: UnitOfWork, bus: EventBus):
        self.uow = uow
        self.bus = bus

    def __call__(self, cmd: ReactivateWorkerCommand) -> Worker:
        with self.uow as uow:
            worker = uow.workers.get(cmd.tenant_id, cmd.worker_id)
            if worker is None:
                raise NotFoundError(f"Worker {cmd.worker_id} no encontrado")
            worker = worker.reactivate()
            uow.workers.save(worker)
            uow.commit()
        self.bus.publish(
            worker_reactivated(tenant_id=worker.tenant_id, worker_id=worker.id)
        )
        return worker


# =====================================================================
# TerminateWorker
# =====================================================================
@dataclass
class TerminateWorkerCommand:
    tenant_id: str
    worker_id: str
    on_date: date


class TerminateWorker:
    def __init__(self, uow: UnitOfWork, bus: EventBus):
        self.uow = uow
        self.bus = bus

    def __call__(self, cmd: TerminateWorkerCommand) -> Worker:
        with self.uow as uow:
            worker = uow.workers.get(cmd.tenant_id, cmd.worker_id)
            if worker is None:
                raise NotFoundError(f"Worker {cmd.worker_id} no encontrado")
            worker = worker.terminate(cmd.on_date)
            uow.workers.save(worker)
            uow.commit()
        self.bus.publish(
            worker_terminated(tenant_id=worker.tenant_id, worker_id=worker.id)
        )
        return worker
