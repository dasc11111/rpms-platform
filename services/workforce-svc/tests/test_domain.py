"""Tests puros del dominio Worker (sin infraestructura)."""

from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

_SVC = Path(__file__).resolve().parents[1]
_LIBS = Path(__file__).resolve().parents[3] / "libs" / "rpms-core"
sys.path.insert(0, str(_SVC))
sys.path.insert(0, str(_LIBS))

from rpms_core import ValidationError  # noqa: E402

from src.domain import (  # noqa: E402
    Authorization,
    AuthorizationStatus,
    AuthorizationType,
    ICRPCategory,
    NationalId,
    Worker,
    WorkerStatus,
)


class TestNationalId(unittest.TestCase):
    def test_valid_chilean_rut(self):
        nid = NationalId(value="17.245.892-0", country="CL")
        self.assertEqual(nid.normalized, "172458920")

    def test_invalid_rut_rejected(self):
        with self.assertRaises(ValidationError):
            NationalId(value="17.245.892-4", country="CL")

    def test_non_chilean_id_accepted_as_is(self):
        nid = NationalId(value="ABC12345", country="AR")
        self.assertEqual(nid.normalized, "ABC12345")

    def test_country_must_be_alpha2(self):
        with self.assertRaises(ValidationError):
            NationalId(value="X", country="CHILE")


class TestWorkerCreation(unittest.TestCase):
    def _make_worker(self, **overrides):
        defaults = {
            "tenant_id": "tenant-1",
            "national_id": NationalId(value="172458920", country="CL"),
            "full_name": "Javiera Muñoz",
            "icrp_category": ICRPCategory.A,
        }
        defaults.update(overrides)
        return Worker(**defaults)

    def test_creation_default_status_is_onboarding(self):
        w = self._make_worker()
        self.assertEqual(w.status, WorkerStatus.ONBOARDING)

    def test_full_name_required(self):
        with self.assertRaises(ValidationError):
            self._make_worker(full_name="")

    def test_full_name_min_length(self):
        with self.assertRaises(ValidationError):
            self._make_worker(full_name="Jo")

    def test_tenant_id_required(self):
        with self.assertRaises(ValidationError):
            self._make_worker(tenant_id="")

    def test_sex_validation(self):
        w = self._make_worker(sex="F")
        self.assertEqual(w.sex, "F")
        with self.assertRaises(ValidationError):
            self._make_worker(sex="Femenino")


class TestWorkerLifecycle(unittest.TestCase):
    def setUp(self):
        self.w = Worker(
            tenant_id="t",
            national_id=NationalId(value="172458920", country="CL"),
            full_name="Javiera Muñoz",
            icrp_category=ICRPCategory.A,
        )

    def test_activate_requires_service_and_facility(self):
        with self.assertRaises(ValidationError):
            self.w.activate(service_id="", facility_id="f")
        with self.assertRaises(ValidationError):
            self.w.activate(service_id="s", facility_id="")

    def test_activate_transitions_state(self):
        activated = self.w.activate(service_id="s1", facility_id="f1")
        self.assertEqual(activated.status, WorkerStatus.ACTIVE)
        self.assertEqual(activated.primary_service_id, "s1")
        self.assertEqual(activated.primary_facility_id, "f1")
        # inmutabilidad estructural: la instancia original no cambia
        self.assertEqual(self.w.status, WorkerStatus.ONBOARDING)

    def test_cannot_reactivate_terminated(self):
        terminated = self.w.terminate(date(2026, 7, 14))
        with self.assertRaises(ValidationError):
            terminated.activate(service_id="s", facility_id="f")

    def test_suspend_requires_reason(self):
        active = self.w.activate(service_id="s", facility_id="f")
        with self.assertRaises(ValidationError):
            active.suspend("no")  # < 5 chars

    def test_suspend_and_reactivate(self):
        active = self.w.activate(service_id="s", facility_id="f")
        suspended = active.suspend("Baja médica temporal")
        self.assertEqual(suspended.status, WorkerStatus.SUSPENDED)
        reactivated = suspended.reactivate()
        self.assertEqual(reactivated.status, WorkerStatus.ACTIVE)

    def test_cannot_suspend_non_active(self):
        with self.assertRaises(ValidationError):
            self.w.suspend("Motivo válido X")

    def test_cannot_reactivate_non_suspended(self):
        with self.assertRaises(ValidationError):
            self.w.reactivate()

    def test_terminate_before_hire_date_rejected(self):
        w = Worker(
            tenant_id="t",
            national_id=NationalId(value="172458920", country="CL"),
            full_name="Javiera Muñoz",
            icrp_category=ICRPCategory.A,
            hire_date=date(2026, 1, 15),
        )
        with self.assertRaises(ValidationError):
            w.terminate(date(2025, 12, 1))

    def test_cannot_terminate_twice(self):
        t1 = self.w.terminate(date(2026, 7, 14))
        with self.assertRaises(ValidationError):
            t1.terminate(date(2026, 7, 15))


class TestICRPBehavior(unittest.TestCase):
    def test_category_a_requires_dosimeter(self):
        w = Worker(
            tenant_id="t",
            national_id=NationalId(value="172458920", country="CL"),
            full_name="Cat A",
            icrp_category=ICRPCategory.A,
        )
        self.assertTrue(w.requires_dosimeter())

    def test_annual_dose_limit(self):
        w = Worker(
            tenant_id="t",
            national_id=NationalId(value="172458920", country="CL"),
            full_name="Test Worker",
            icrp_category=ICRPCategory.A,
        )
        self.assertEqual(w.annual_dose_limit_msv(), 20.0)
        self.assertEqual(w.five_year_dose_limit_msv(), 100.0)


class TestAuthorization(unittest.TestCase):
    def _make(self, **overrides):
        defaults = {
            "tenant_id": "t",
            "worker_id": "w",
            "authorization_type": AuthorizationType.OPR,
            "issued_by": "SEREMI RM",
            "issued_at": date(2024, 3, 15),
            "expires_at": date(2026, 8, 30),
        }
        defaults.update(overrides)
        return Authorization(**defaults)

    def test_valid_authorization(self):
        a = self._make()
        self.assertTrue(a.is_valid_on(date(2025, 6, 1)))

    def test_expired(self):
        a = self._make(expires_at=date(2025, 1, 1))
        self.assertFalse(a.is_valid_on(date(2026, 1, 1)))

    def test_revoked_never_valid(self):
        a = self._make(status=AuthorizationStatus.REVOKED)
        self.assertFalse(a.is_valid_on(date(2025, 1, 1)))

    def test_expires_at_before_issued_at_rejected(self):
        with self.assertRaises(ValidationError):
            self._make(issued_at=date(2024, 6, 1), expires_at=date(2024, 1, 1))

    def test_days_until_expiry(self):
        a = self._make(expires_at=date(2026, 8, 30))
        self.assertEqual(a.days_until_expiry(date(2026, 7, 14)), 47)

    def test_expiring_soon(self):
        a = self._make(expires_at=date(2026, 8, 30))
        self.assertTrue(a.is_expiring_soon(date(2026, 7, 14), threshold_days=90))
        self.assertFalse(a.is_expiring_soon(date(2026, 1, 1), threshold_days=90))


if __name__ == "__main__":
    unittest.main(verbosity=2)
