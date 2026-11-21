"""Tests unitarios de rpms-core."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

# Añadir el paquete al sys.path (en producción se instala como paquete)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rpms_core import (
    Clock,
    ConflictError,
    DomainEvent,
    EventBus,
    FrozenClock,
    NotFoundError,
    RegulatoryError,
    RPMSError,
    SystemClock,
    ValidationError,
    format_rut,
    is_uuid,
    new_uuid,
    normalize_rut,
    validate_rut,
)
from rpms_core.rut import compute_dv


class TestIdentifiers(unittest.TestCase):
    def test_new_uuid_is_valid(self):
        uid = new_uuid()
        self.assertTrue(is_uuid(uid))

    def test_new_uuid_uniqueness(self):
        self.assertNotEqual(new_uuid(), new_uuid())

    def test_is_uuid_rejects_invalid(self):
        for bad in ["", "not-a-uuid", "12345", None, 123]:
            self.assertFalse(is_uuid(bad))


class TestRUT(unittest.TestCase):
    """Validación del algoritmo módulo 11 del RUT chileno."""

    def test_compute_dv_known_values(self):
        # Casos conocidos verificables manualmente
        self.assertEqual(compute_dv(1), "9")
        self.assertEqual(compute_dv(11111111), "1")
        self.assertEqual(compute_dv(17245892), "0")
        # Ejemplo con dígito verificador 'K' (valor calculado)
        self.assertEqual(compute_dv(1000005), "K")

    def test_validate_valid_ruts(self):
        for rut in [
            "17.245.892-0",
            "17245892-0",
            "172458920",
            "11.111.111-1",
            "1.000.005-K",
            "1000005-k",  # case insensitive
        ]:
            self.assertTrue(validate_rut(rut), f"Debe ser válido: {rut}")

    def test_validate_invalid_ruts(self):
        for rut in [
            "17.245.892-4",  # DV incorrecto (correcto es 0)
            "17.245.892-3",  # DV incorrecto también
            "abc-1",
            "",
            "1",
            None,
            "17.245.892",  # sin DV
        ]:
            self.assertFalse(validate_rut(rut), f"Debe ser inválido: {rut}")

    def test_format_rut(self):
        self.assertEqual(format_rut("172458920"), "17.245.892-0")
        self.assertEqual(format_rut("17.245.892-0"), "17.245.892-0")
        self.assertEqual(format_rut("1000005K"), "1.000.005-K")

    def test_normalize_rut(self):
        self.assertEqual(normalize_rut("17.245.892-0"), "172458920")
        self.assertEqual(normalize_rut("1.000.005-k"), "1000005K")

    def test_format_rejects_invalid(self):
        with self.assertRaises(ValueError):
            format_rut("bad-rut")


class TestErrors(unittest.TestCase):
    def test_hierarchy(self):
        for cls in (NotFoundError, ValidationError, ConflictError):
            err = cls("test")
            self.assertIsInstance(err, RPMSError)

    def test_problem_details(self):
        err = ValidationError("Campo faltante", details={"field": "email"})
        problem = err.to_problem()
        self.assertEqual(problem["status"], 422)
        self.assertEqual(problem["code"], "validation_error")
        self.assertEqual(problem["errors"], {"field": "email"})

    def test_regulatory_error_includes_rule_id(self):
        err = RegulatoryError(
            "Trabajador cat. A sin dosímetro",
            rule_id="CL-DS3-DOSIMETRO-MENSUAL",
        )
        self.assertIn("rule_id", err.details)
        self.assertEqual(err.details["rule_id"], "CL-DS3-DOSIMETRO-MENSUAL")


class TestClock(unittest.TestCase):
    def test_system_clock_returns_current_time(self):
        c: Clock = SystemClock()
        self.assertIsNotNone(c.now())
        self.assertIsNotNone(c.today())

    def test_frozen_clock_is_deterministic(self):
        moment = datetime(2026, 7, 14, 12, 0, tzinfo=timezone.utc)
        c = FrozenClock(moment)
        self.assertEqual(c.now(), moment)
        self.assertEqual(c.today().isoformat(), "2026-07-14")

    def test_frozen_clock_advance(self):
        c = FrozenClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
        c.advance(days=30)
        self.assertEqual(c.today().isoformat(), "2026-01-31")


class TestEvents(unittest.TestCase):
    def test_event_bus_publishes_and_records(self):
        bus = EventBus()
        received = []
        bus.subscribe("workforce.worker.created.v1", lambda e: received.append(e))
        ev = DomainEvent(
            name="workforce.worker.created.v1",
            payload={"worker_id": "abc"},
            tenant_id="tenant-1",
        )
        bus.publish(ev)
        self.assertEqual(len(received), 1)
        self.assertEqual(bus.published[0].payload["worker_id"], "abc")

    def test_wildcard_subscriber(self):
        bus = EventBus()
        all_events = []
        bus.subscribe("*", all_events.append)
        bus.publish(DomainEvent(name="a.b.c", payload={}, tenant_id="t"))
        bus.publish(DomainEvent(name="x.y.z", payload={}, tenant_id="t"))
        self.assertEqual(len(all_events), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
