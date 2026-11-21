"""Router HTTP del workforce-svc.

Escrito como funciones puras que aceptan diccionarios de request y devuelven
tuplas (status_code, body_dict). Un adapter FastAPI o Flask se añade encima.

En producción, este archivo se importa desde una app FastAPI y se registran
los routers con decoradores estándar. Aquí lo mantenemos ejecutable sin
frameworks para poder testear en el sandbox.
"""

from __future__ import annotations

import sys
from pathlib import Path

_LIBS = Path(__file__).resolve().parents[3].parent / "libs" / "rpms-core"
if str(_LIBS) not in sys.path:
    sys.path.insert(0, str(_LIBS))

from rpms_core import RPMSError  # noqa: E402

from ..application import (  # noqa: E402
    ActivateWorker,
    ActivateWorkerCommand,
    CountActiveWorkers,
    CreateWorker,
    CreateWorkerCommand,
    GetWorker,
    ListActiveWorkers,
    SuspendWorker,
    SuspendWorkerCommand,
)
from .schemas import (  # noqa: E402
    ActivateWorkerRequest,
    CreateWorkerRequest,
    SuspendWorkerRequest,
)


class WorkerRouter:
    """Router funcional para el recurso Worker.

    Cada handler recibe path_params y body_json y devuelve (status, body).
    """

    def __init__(
        self,
        *,
        create_worker: CreateWorker,
        activate_worker: ActivateWorker,
        suspend_worker: SuspendWorker,
        get_worker: GetWorker,
        list_active: ListActiveWorkers,
        count_active: CountActiveWorkers,
    ):
        self.create_worker = create_worker
        self.activate_worker = activate_worker
        self.suspend_worker = suspend_worker
        self.get_worker = get_worker
        self.list_active = list_active
        self.count_active = count_active

    # POST /v1/workers
    def create(self, body: dict) -> tuple[int, dict]:
        try:
            req = CreateWorkerRequest(**body)
            cmd = CreateWorkerCommand(
                tenant_id=req.tenant_id,
                national_id=req.national_id,
                national_id_country=req.national_id_country,
                full_name=req.full_name,
                icrp_category=req.icrp_category,
                profession=req.profession,
                job_title=req.job_title,
                hire_date=req.parsed_hire_date(),
                sex=req.sex,
            )
            worker = self.create_worker(cmd)
            return 201, {
                "id": worker.id,
                "national_id": worker.national_id.normalized,
                "full_name": worker.full_name,
                "status": worker.status.value,
                "icrp_category": worker.icrp_category.value,
                "_links": {
                    "self": f"/v1/workers/{worker.id}",
                    "activate": f"/v1/workers/{worker.id}:activate",
                },
            }
        except RPMSError as err:
            return err.status_code, err.to_problem()
        except TypeError as err:
            return 422, {
                "type": "about:blank#validation_error",
                "title": "ValidationError",
                "status": 422,
                "detail": f"Payload inválido: {err}",
                "code": "validation_error",
            }

    # GET /v1/workers/{worker_id}
    def get(self, tenant_id: str, worker_id: str) -> tuple[int, dict]:
        dto = self.get_worker(tenant_id, worker_id)
        if dto is None:
            return 404, {
                "type": "about:blank#not_found",
                "title": "NotFoundError",
                "status": 404,
                "detail": f"Worker {worker_id} no encontrado",
                "code": "not_found",
            }
        return 200, dto.to_dict()

    # POST /v1/workers/{worker_id}:activate
    def activate(self, tenant_id: str, worker_id: str, body: dict) -> tuple[int, dict]:
        try:
            req = ActivateWorkerRequest(**body)
            cmd = ActivateWorkerCommand(
                tenant_id=tenant_id,
                worker_id=worker_id,
                service_id=req.service_id,
                facility_id=req.facility_id,
            )
            worker = self.activate_worker(cmd)
            return 200, {"id": worker.id, "status": worker.status.value}
        except RPMSError as err:
            return err.status_code, err.to_problem()

    # POST /v1/workers/{worker_id}:suspend
    def suspend(self, tenant_id: str, worker_id: str, body: dict) -> tuple[int, dict]:
        try:
            req = SuspendWorkerRequest(**body)
            cmd = SuspendWorkerCommand(
                tenant_id=tenant_id, worker_id=worker_id, reason=req.reason
            )
            worker = self.suspend_worker(cmd)
            return 200, {"id": worker.id, "status": worker.status.value}
        except RPMSError as err:
            return err.status_code, err.to_problem()

    # GET /v1/workers?service_id=&limit=&offset=
    def list(self, tenant_id: str, query: dict) -> tuple[int, dict]:
        service_id = query.get("service_id")
        limit = int(query.get("limit", 50))
        offset = int(query.get("offset", 0))
        results = self.list_active(tenant_id, service_id=service_id, limit=limit, offset=offset)
        total = self.count_active(tenant_id)
        return 200, {
            "items": [r.to_dict() for r in results],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
