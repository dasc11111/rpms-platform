"""Tests de integración del workforce-svc.

Levantan una BD SQLite en memoria, aplican migraciones y ejercitan
los casos de uso completos y el router HTTP.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
_SVC = Path(__file__).resolve().parents[1]
_LIBS = _ROOT / "libs" / "rpms-core"
sys.path.insert(0, str(_SVC))
sys.path.insert(0, str(_LIBS))
sys.path.insert(0, str(_ROOT / "db" / "scripts"))

from apply_migrations import apply_sqlite  # noqa: E402
from rpms_core import ConflictError, EventBus, NotFoundError, SystemClock  # noqa: E402

from src.api.container import build_router  # noqa: E402
from src.application import (  # noqa: E402
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
from src.infrastructure import SqliteUnitOfWork  # noqa: E402


TENANT_ID = "00000000-0000-4000-8000-000000000001"


def _prepare_db() -> str:
    """Crea BD SQLite temporal con migraciones aplicadas y tenant sembrado."""
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    apply_sqlite(path, fresh=True, verbose=False)
    # Insertar el tenant que usaremos
    import sqlite3
    con = sqlite3.connect(path)
    con.execute(
        "INSERT INTO tenant (id, name, slug, country_code, plan, data_region, status) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (TENANT_ID, "Test Tenant", "test", "CL", "starter", "scl", "active"),
    )
    # Y una facility + service para tests de activación
    con.execute(
        "INSERT INTO facility (id, tenant_id, name, facility_type, country_code) "
        "VALUES (?, ?, ?, ?, ?)",
        ("f1", TENANT_ID, "Hospital Test", "hospital", "CL"),
    )
    con.execute(
        "INSERT INTO service (id, tenant_id, facility_id, name, service_type) "
        "VALUES (?, ?, ?, ?, ?)",
        ("s1", TENANT_ID, "f1", "Radioterapia", "radiotherapy"),
    )
    con.commit()
    con.close()
    return path


class TestCreateWorkerUseCase(unittest.TestCase):
    def setUp(self):
        self.db_path = _prepare_db()
        self.uow = SqliteUnitOfWork(self.db_path)
        self.bus = EventBus()
        self.clock = SystemClock()
        self.use_case = CreateWorker(self.uow, self.bus, self.clock)

    def tearDown(self):
        os.unlink(self.db_path)

    def _cmd(self, **overrides):
        defaults = {
            "tenant_id": TENANT_ID,
            "national_id": "17.245.892-0",
            "national_id_country": "CL",
            "full_name": "Javiera Muñoz",
            "icrp_category": "A",
            "profession": "Físico Médico",
        }
        defaults.update(overrides)
        return CreateWorkerCommand(**defaults)

    def test_create_worker_persists_and_publishes_event(self):
        w = self.use_case(self._cmd())
        self.assertIsNotNone(w.id)
        self.assertEqual(w.status.value, "onboarding")
        # Se publicó exactamente 1 evento
        self.assertEqual(len(self.bus.published), 1)
        self.assertEqual(self.bus.published[0].name, "workforce.worker.created.v1")

    def test_duplicate_national_id_conflict(self):
        self.use_case(self._cmd())
        with self.assertRaises(ConflictError):
            self.use_case(self._cmd())

    def test_invalid_rut_rejected(self):
        from rpms_core import ValidationError
        with self.assertRaises(ValidationError):
            self.use_case(self._cmd(national_id="17.245.892-9"))

    def test_invalid_icrp_category_rejected(self):
        from rpms_core import ValidationError
        with self.assertRaises(ValidationError):
            self.use_case(self._cmd(icrp_category="C"))


class TestWorkerLifecycleUseCases(unittest.TestCase):
    def setUp(self):
        self.db_path = _prepare_db()
        self.uow = SqliteUnitOfWork(self.db_path)
        self.bus = EventBus()
        self.clock = SystemClock()
        self.create = CreateWorker(self.uow, self.bus, self.clock)
        self.activate = ActivateWorker(self.uow, self.bus)
        self.suspend = SuspendWorker(self.uow, self.bus)
        self.worker = self.create(
            CreateWorkerCommand(
                tenant_id=TENANT_ID,
                national_id="17.245.892-0",
                national_id_country="CL",
                full_name="Javiera Muñoz",
                icrp_category="A",
            )
        )
        self.bus.clear()

    def tearDown(self):
        os.unlink(self.db_path)

    def test_activation_flow(self):
        active = self.activate(
            ActivateWorkerCommand(
                tenant_id=TENANT_ID,
                worker_id=self.worker.id,
                service_id="s1",
                facility_id="f1",
            )
        )
        self.assertEqual(active.status.value, "active")
        self.assertEqual(len(self.bus.published), 1)
        self.assertEqual(self.bus.published[0].name, "workforce.worker.activated.v1")

    def test_activation_of_missing_worker_returns_not_found(self):
        with self.assertRaises(NotFoundError):
            self.activate(
                ActivateWorkerCommand(
                    tenant_id=TENANT_ID,
                    worker_id="does-not-exist",
                    service_id="s1",
                    facility_id="f1",
                )
            )

    def test_suspension_flow(self):
        self.activate(
            ActivateWorkerCommand(
                tenant_id=TENANT_ID,
                worker_id=self.worker.id,
                service_id="s1",
                facility_id="f1",
            )
        )
        suspended = self.suspend(
            SuspendWorkerCommand(
                tenant_id=TENANT_ID,
                worker_id=self.worker.id,
                reason="Baja médica por 30 días",
            )
        )
        self.assertEqual(suspended.status.value, "suspended")


class TestQueries(unittest.TestCase):
    def setUp(self):
        self.db_path = _prepare_db()
        self.uow = SqliteUnitOfWork(self.db_path)
        self.bus = EventBus()
        self.create = CreateWorker(self.uow, self.bus, SystemClock())
        self.activate = ActivateWorker(self.uow, self.bus)

        # Crear + activar 3 workers, dejar 1 onboarding
        for i, (rut, name) in enumerate([
            ("172458920", "Javiera Muñoz"),
            ("181234563", "Marcelo Rojas"),
            ("159876543", "Camila Torres"),
            ("164567893", "Andrés Silva"),
        ]):
            w = self.create(CreateWorkerCommand(
                tenant_id=TENANT_ID, national_id=rut, national_id_country="CL",
                full_name=name, icrp_category="A",
            ))
            if i < 3:  # activo solo los primeros 3
                self.activate(ActivateWorkerCommand(
                    tenant_id=TENANT_ID, worker_id=w.id,
                    service_id="s1", facility_id="f1",
                ))

    def tearDown(self):
        os.unlink(self.db_path)

    def test_count_active_workers(self):
        q = CountActiveWorkers(self.uow)
        self.assertEqual(q(TENANT_ID), 3)

    def test_list_active_workers(self):
        q = ListActiveWorkers(self.uow)
        results = q(TENANT_ID)
        self.assertEqual(len(results), 3)
        # ordenados por nombre
        names = [r.full_name for r in results]
        self.assertEqual(names, sorted(names))


class TestHttpRouter(unittest.TestCase):
    """Verifica el router HTTP como capa portable (sin FastAPI/Flask)."""

    def setUp(self):
        self.db_path = _prepare_db()
        self.router = build_router(self.db_path)

    def tearDown(self):
        os.unlink(self.db_path)

    def test_post_create_worker_201(self):
        status, body = self.router.create({
            "tenant_id": TENANT_ID,
            "national_id": "17.245.892-0",
            "national_id_country": "CL",
            "full_name": "Javiera Muñoz",
            "icrp_category": "A",
            "profession": "Físico Médico",
        })
        self.assertEqual(status, 201)
        self.assertIn("_links", body)
        self.assertEqual(body["status"], "onboarding")

    def test_post_create_duplicate_returns_409(self):
        payload = {
            "tenant_id": TENANT_ID,
            "national_id": "17.245.892-0",
            "national_id_country": "CL",
            "full_name": "Javiera Muñoz",
            "icrp_category": "A",
        }
        self.router.create(payload)
        status, body = self.router.create(payload)
        self.assertEqual(status, 409)
        self.assertEqual(body["code"], "conflict")

    def test_post_create_invalid_rut_returns_422(self):
        status, body = self.router.create({
            "tenant_id": TENANT_ID,
            "national_id": "17.245.892-9",  # DV incorrecto
            "national_id_country": "CL",
            "full_name": "Falso",
            "icrp_category": "A",
        })
        self.assertEqual(status, 422)
        self.assertEqual(body["code"], "validation_error")

    def test_get_returns_404_for_missing(self):
        status, body = self.router.get(TENANT_ID, "does-not-exist")
        self.assertEqual(status, 404)

    def test_activate_endpoint(self):
        _, created = self.router.create({
            "tenant_id": TENANT_ID,
            "national_id": "17.245.892-0",
            "national_id_country": "CL",
            "full_name": "Javiera Muñoz",
            "icrp_category": "A",
        })
        worker_id = created["id"]
        status, body = self.router.activate(
            TENANT_ID, worker_id, {"service_id": "s1", "facility_id": "f1"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "active")

    def test_suspend_active_worker(self):
        _, created = self.router.create({
            "tenant_id": TENANT_ID,
            "national_id": "17.245.892-0",
            "national_id_country": "CL",
            "full_name": "Javiera Muñoz",
            "icrp_category": "A",
        })
        worker_id = created["id"]
        self.router.activate(TENANT_ID, worker_id, {"service_id": "s1", "facility_id": "f1"})
        status, body = self.router.suspend(TENANT_ID, worker_id, {"reason": "Vacaciones extendidas por baja"})
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "suspended")

    def test_list_with_pagination(self):
        for rut, name in [
            ("172458920", "A Worker"),
            ("181234563", "B Worker"),
            ("159876543", "C Worker"),
        ]:
            _, created = self.router.create({
                "tenant_id": TENANT_ID,
                "national_id": rut,
                "national_id_country": "CL",
                "full_name": name,
                "icrp_category": "A",
            })
            self.router.activate(TENANT_ID, created["id"],
                                 {"service_id": "s1", "facility_id": "f1"})
        status, body = self.router.list(TENANT_ID, {"limit": 2, "offset": 0})
        self.assertEqual(status, 200)
        self.assertEqual(len(body["items"]), 2)
        self.assertEqual(body["total"], 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
