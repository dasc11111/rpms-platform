"""Composition root del workforce-svc.

Ensambla dependencias e instancia los casos de uso. Este archivo es el
único lugar donde se conocen los adaptadores concretos.
"""

from __future__ import annotations

import sys
from pathlib import Path

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import EventBus, SystemClock  # noqa: E402

from ..application import (  # noqa: E402
    ActivateWorker,
    CountActiveWorkers,
    CreateWorker,
    GetWorker,
    ListActiveWorkers,
    ListExpiringAuthorizations,
    ReactivateWorker,
    SuspendWorker,
    TerminateWorker,
)
from ..infrastructure import SqliteUnitOfWork  # noqa: E402
from .router import WorkerRouter  # noqa: E402


def build_router(db_path: str, bus: EventBus | None = None) -> WorkerRouter:
    """Construye un WorkerRouter listo para servir requests."""
    if bus is None:
        bus = EventBus()
    clock = SystemClock()
    uow = SqliteUnitOfWork(db_path)

    create_worker = CreateWorker(uow, bus, clock)
    activate_worker = ActivateWorker(uow, bus)
    suspend_worker = SuspendWorker(uow, bus)
    get_worker = GetWorker(uow)
    list_active = ListActiveWorkers(uow)
    count_active = CountActiveWorkers(uow)

    return WorkerRouter(
        create_worker=create_worker,
        activate_worker=activate_worker,
        suspend_worker=suspend_worker,
        get_worker=get_worker,
        list_active=list_active,
        count_active=count_active,
    )
