"""Tests del motor de reglas de cumplimiento con escenarios reales."""

from __future__ import annotations

import sys
import unittest
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

_SVC = Path(__file__).resolve().parents[1]
_LIBS = Path(__file__).resolve().parents[3] / "libs" / "rpms-core"
sys.path.insert(0, str(_LIBS))
sys.path.insert(0, str(_SVC))

from src.domain import EvaluationContext, RuleEngine, Severity  # noqa: E402
from src.rules import CHILE_RULES  # noqa: E402
from src.domain import ComplianceFinding  # noqa: E402

# Simulamos las clases de dominio con dataclasses simples


class _Status:
    def __init__(self, value): self.value = value


@dataclass
class MockWorker:
    id: str
    full_name: str
    status: _Status
    icrp_category: _Status


@dataclass
class MockEquipment:
    id: str
    manufacturer: str
    model: str
    serial_number: str
    status: str


@dataclass
class MockLicense:
    id: str
    license_type: str
    status: str
    expires_at: Optional[date] = None


@dataclass
class MockAuthorization:
    id: str
    status: _Status
    number: str
    expires_at: Optional[date] = None


@dataclass
class MockDoseReading:
    period_start: date
    period_end: date


@dataclass
class MockInstrument:
    id: str
    manufacturer: str
    model: str
    serial_number: str
    status: str
    next_calibration_at: Optional[date]


class TestEquipmentAuthorizationRule(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine(CHILE_RULES)
        self.today = date(2026, 7, 14)

    def test_equipment_without_license_is_flagged(self):
        eq = MockEquipment(
            id="eq1", manufacturer="Varian", model="TrueBeam",
            serial_number="TB-45781", status="active",
        )
        ctx = EvaluationContext(
            tenant_id="t", on_date=self.today,
            licenses_by_subject={},  # sin licencias
        )
        findings = self.engine.evaluate({"equipment": [eq]}, ctx)
        equipment_findings = [f for f in findings if f.entity_type == "equipment"]
        self.assertEqual(len(equipment_findings), 1)
        self.assertEqual(equipment_findings[0].severity, Severity.CRITICAL)
        self.assertEqual(equipment_findings[0].rule_id, "CL-DS133-EQUIPO-AUTORIZACION")

    def test_equipment_with_active_license_ok(self):
        eq = MockEquipment(
            id="eq1", manufacturer="Varian", model="TrueBeam",
            serial_number="TB-45781", status="active",
        )
        lic = MockLicense(id="l1", license_type="operation", status="active")
        ctx = EvaluationContext(
            tenant_id="t", on_date=self.today,
            licenses_by_subject={"eq1": [lic]},
        )
        findings = self.engine.evaluate({"equipment": [eq]}, ctx)
        eq_findings = [f for f in findings if f.entity_type == "equipment"]
        self.assertEqual(len(eq_findings), 0)

    def test_decommissioned_equipment_is_not_flagged(self):
        eq = MockEquipment(
            id="eq1", manufacturer="X", model="Y",
            serial_number="Z", status="decommissioned",
        )
        ctx = EvaluationContext(tenant_id="t", on_date=self.today)
        findings = self.engine.evaluate({"equipment": [eq]}, ctx)
        eq_findings = [f for f in findings if f.entity_type == "equipment"]
        self.assertEqual(len(eq_findings), 0)


class TestWorkerMonthlyDosimetryRule(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine(CHILE_RULES)
        self.today = date(2026, 7, 14)  # buscamos lectura de junio

    def test_cat_a_worker_without_prior_month_reading_flagged(self):
        w = MockWorker(
            id="w1", full_name="Javiera",
            status=_Status("active"),
            icrp_category=_Status("A"),
        )
        auth = MockAuthorization(
            id="a1", status=_Status("active"), number="AUT-1",
            expires_at=date(2028, 1, 1),
        )
        ctx = EvaluationContext(
            tenant_id="t", on_date=self.today,
            dose_readings_by_worker={},  # sin lecturas
            authorizations_by_worker={"w1": [auth]},  # sí tiene autorización
        )
        findings = self.engine.evaluate({"worker": [w]}, ctx)
        dosimetry = [f for f in findings if f.rule_id == "CL-DS3-DOSIMETRO-MENSUAL"]
        self.assertEqual(len(dosimetry), 1)

    def test_cat_a_worker_with_prior_month_reading_ok(self):
        w = MockWorker(
            id="w1", full_name="Javiera",
            status=_Status("active"),
            icrp_category=_Status("A"),
        )
        auth = MockAuthorization(
            id="a1", status=_Status("active"), number="AUT-1",
            expires_at=date(2028, 1, 1),
        )
        # Lectura que cubre junio 2026
        reading = MockDoseReading(
            period_start=date(2026, 6, 1),
            period_end=date(2026, 6, 30),
        )
        ctx = EvaluationContext(
            tenant_id="t", on_date=self.today,
            dose_readings_by_worker={"w1": [reading]},
            authorizations_by_worker={"w1": [auth]},
        )
        findings = self.engine.evaluate({"worker": [w]}, ctx)
        dosimetry = [f for f in findings if f.rule_id == "CL-DS3-DOSIMETRO-MENSUAL"]
        self.assertEqual(len(dosimetry), 0)

    def test_cat_b_worker_not_required_monthly(self):
        w = MockWorker(
            id="w1", full_name="Paulina",
            status=_Status("active"),
            icrp_category=_Status("B"),
        )
        ctx = EvaluationContext(tenant_id="t", on_date=self.today)
        findings = self.engine.evaluate({"worker": [w]}, ctx)
        dosimetry = [f for f in findings if f.rule_id == "CL-DS3-DOSIMETRO-MENSUAL"]
        self.assertEqual(len(dosimetry), 0)


class TestAuthorizationExpiringRule(unittest.TestCase):
    def test_auth_expiring_in_47_days_flagged(self):
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)
        auth = MockAuthorization(
            id="a1", status=_Status("active"), number="AUT-2024-1000",
            expires_at=date(2026, 8, 30),  # 47 días
        )
        ctx = EvaluationContext(tenant_id="t", on_date=today)
        findings = engine.evaluate({"authorization": [auth]}, ctx)
        matching = [f for f in findings if f.rule_id == "CL-GEN-AUTORIZACION-POR-VENCER"]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0].severity, Severity.MEDIUM)
        self.assertEqual(matching[0].due_date, date(2026, 8, 30))

    def test_auth_expiring_beyond_90_days_not_flagged(self):
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)
        auth = MockAuthorization(
            id="a1", status=_Status("active"), number="AUT-1",
            expires_at=date(2028, 1, 1),
        )
        ctx = EvaluationContext(tenant_id="t", on_date=today)
        findings = engine.evaluate({"authorization": [auth]}, ctx)
        matching = [f for f in findings if f.rule_id == "CL-GEN-AUTORIZACION-POR-VENCER"]
        self.assertEqual(len(matching), 0)

    def test_expired_auth_not_flagged_by_this_rule(self):
        # Ya expiró: debería marcarse por otra regla, no la de "por vencer"
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)
        auth = MockAuthorization(
            id="a1", status=_Status("active"), number="AUT-1",
            expires_at=date(2026, 1, 1),  # ya expiró
        )
        ctx = EvaluationContext(tenant_id="t", on_date=today)
        findings = engine.evaluate({"authorization": [auth]}, ctx)
        matching = [f for f in findings if f.rule_id == "CL-GEN-AUTORIZACION-POR-VENCER"]
        self.assertEqual(len(matching), 0)


class TestInstrumentCalibrationRule(unittest.TestCase):
    def test_overdue_calibration_flagged(self):
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)
        instrument = MockInstrument(
            id="i1", manufacturer="Ludlum", model="Model 3",
            serial_number="LM3-45678", status="active",
            next_calibration_at=date(2025, 4, 15),  # vencida hace 15 meses
        )
        ctx = EvaluationContext(tenant_id="t", on_date=today)
        findings = engine.evaluate({"instrument": [instrument]}, ctx)
        matching = [f for f in findings if f.rule_id == "CL-ISP-INSTRUMENTO-CALIBRACION"]
        self.assertEqual(len(matching), 1)

    def test_never_calibrated_flagged(self):
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)
        instrument = MockInstrument(
            id="i1", manufacturer="X", model="Y",
            serial_number="Z", status="active",
            next_calibration_at=None,
        )
        ctx = EvaluationContext(tenant_id="t", on_date=today)
        findings = engine.evaluate({"instrument": [instrument]}, ctx)
        matching = [f for f in findings if f.rule_id == "CL-ISP-INSTRUMENTO-CALIBRACION"]
        self.assertEqual(len(matching), 1)

    def test_valid_calibration_ok(self):
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)
        instrument = MockInstrument(
            id="i1", manufacturer="X", model="Y",
            serial_number="Z", status="active",
            next_calibration_at=date(2027, 4, 15),
        )
        ctx = EvaluationContext(tenant_id="t", on_date=today)
        findings = engine.evaluate({"instrument": [instrument]}, ctx)
        matching = [f for f in findings if f.rule_id == "CL-ISP-INSTRUMENTO-CALIBRACION"]
        self.assertEqual(len(matching), 0)


class TestRuleEngineIntegration(unittest.TestCase):
    """Escenario de fiscalización SEREMI: evalúa un hospital completo."""

    def test_full_hospital_compliance_scan(self):
        engine = RuleEngine(CHILE_RULES)
        today = date(2026, 7, 14)

        # Configuración del hospital
        workers = [
            MockWorker("w1", "Javiera", _Status("active"), _Status("A")),
            MockWorker("w2", "Marcelo", _Status("active"), _Status("A")),
            MockWorker("w3", "Paulina", _Status("active"), _Status("B")),
        ]
        equipment = [
            MockEquipment("eq1", "Varian", "TrueBeam", "TB1", "active"),
            MockEquipment("eq2", "Siemens", "Biograph", "BV1", "active"),
        ]
        auth_w1 = MockAuthorization(
            "a1", _Status("active"), "AUT-1", date(2028, 1, 1)
        )
        # w2 no tiene autorización, w3 tampoco (pero es Cat. B)
        instruments = [
            MockInstrument(
                "i1", "Ludlum", "Model 3", "LM3", "active",
                date(2025, 4, 15),  # vencida
            ),
        ]

        ctx = EvaluationContext(
            tenant_id="t", on_date=today,
            authorizations_by_worker={"w1": [auth_w1]},
            dose_readings_by_worker={
                "w1": [MockDoseReading(date(2026, 6, 1), date(2026, 6, 30))],
                # w2 sin lecturas → hallazgo
            },
            licenses_by_subject={
                "eq1": [MockLicense("l1", "operation", "active")],
                # eq2 sin licencia → hallazgo
            },
        )

        findings = engine.evaluate(
            {
                "worker": workers,
                "equipment": equipment,
                "instrument": instruments,
                "authorization": [auth_w1],
            },
            ctx,
        )
        summary = engine.evaluate_summary(findings)

        # Debe haber al menos:
        # - eq2 sin licencia (CRITICAL)
        # - w2 sin lectura dosimétrica (HIGH)
        # - w2 sin autorización activa (CRITICAL)
        # - instrument i1 con calibración vencida (HIGH)
        self.assertGreaterEqual(summary["total"], 4)
        self.assertIn("critical", summary["by_severity"])
        self.assertIn("high", summary["by_severity"])

        rule_ids = {f.rule_id for f in findings}
        self.assertIn("CL-DS133-EQUIPO-AUTORIZACION", rule_ids)
        self.assertIn("CL-DS3-DOSIMETRO-MENSUAL", rule_ids)
        self.assertIn("CL-DS3-TRABAJADOR-AUTORIZACION", rule_ids)
        self.assertIn("CL-ISP-INSTRUMENTO-CALIBRACION", rule_ids)


class TestRuleValidity(unittest.TestCase):
    def test_rule_not_applicable_out_of_valid_range(self):
        from src.domain import Rule
        r = Rule(
            id="R", jurisdiction="CL", severity=Severity.LOW,
            message_template="test", entity_type="foo",
            predicate=lambda e, c: True,
            valid_from=date(2027, 1, 1),
        )
        self.assertFalse(r.applies_on(date(2026, 12, 31)))
        self.assertTrue(r.applies_on(date(2027, 6, 1)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
