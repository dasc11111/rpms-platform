"""Tests del dominio Dosimetry."""

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
    AnomalyResult,
    CombinedAnomalyDetector,
    DoseReading,
    HeuristicAnomalyDetector,
    ICRPLimits,
    IsolationForestDetector,
    annual_summary,
    five_year_summary,
    parse_generic_csv,
    summarize_period,
)


def _reading(**overrides):
    defaults = dict(
        tenant_id="t",
        worker_id="w",
        dosimeter_id="d",
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        hp10_msv=0.5,
        hp007_msv=0.55,
        hp3_msv=0.48,
    )
    defaults.update(overrides)
    return DoseReading(**defaults)


class TestDoseReading(unittest.TestCase):
    def test_negative_dose_rejected(self):
        with self.assertRaises(ValidationError):
            _reading(hp10_msv=-0.5)

    def test_period_end_before_start_rejected(self):
        with self.assertRaises(ValidationError):
            _reading(
                period_start=date(2026, 2, 1),
                period_end=date(2026, 1, 1),
            )

    def test_effective_dose_msv_uses_hp10(self):
        r = _reading(hp10_msv=1.2, neutron_msv=0.3)
        self.assertEqual(r.effective_dose_msv, 1.5)

    def test_none_values_allowed(self):
        r = _reading(hp10_msv=None, hp007_msv=None, hp3_msv=None)
        self.assertEqual(r.effective_dose_msv, 0.0)


class TestSummaries(unittest.TestCase):
    def _make_year_of_readings(self, worker_id="w", monthly_dose=0.5, year=2026):
        return [
            _reading(
                worker_id=worker_id,
                period_start=date(year, m, 1),
                period_end=date(year, m, 28),
                hp10_msv=monthly_dose,
                hp007_msv=monthly_dose * 1.1,
                hp3_msv=monthly_dose * 0.9,
            )
            for m in range(1, 13)
        ]

    def test_annual_summary(self):
        readings = self._make_year_of_readings(monthly_dose=0.5)
        s = annual_summary(readings, "w", 2026)
        self.assertAlmostEqual(s.hp10_msv_sum, 6.0, places=2)
        self.assertEqual(s.reading_count, 12)

    def test_filters_by_worker(self):
        readings = self._make_year_of_readings("w1") + self._make_year_of_readings("w2", 0.2)
        s = annual_summary(readings, "w1", 2026)
        self.assertEqual(s.reading_count, 12)
        self.assertAlmostEqual(s.hp10_msv_sum, 6.0, places=2)

    def test_five_year_summary(self):
        readings = []
        for y in range(2022, 2027):
            readings.extend(self._make_year_of_readings(year=y, monthly_dose=0.3))
        s = five_year_summary(readings, "w", 2026)
        self.assertAlmostEqual(s.hp10_msv_sum, 12 * 0.3 * 5, places=1)
        self.assertEqual(s.reading_count, 60)


class TestICRPLimits(unittest.TestCase):
    def test_investigation_level(self):
        self.assertEqual(ICRPLimits.investigation_level_msv(), 10.0)

    def test_evaluate_normal(self):
        from src.domain.dose import DoseSummary
        s = DoseSummary("w", "2026", date(2026, 1, 1), date(2026, 12, 31),
                        2.0, 2.2, 1.9, 0, 12, False)
        level, _ = ICRPLimits.evaluate_annual(s)
        self.assertEqual(level, "normal")

    def test_evaluate_notification(self):
        from src.domain.dose import DoseSummary
        s = DoseSummary("w", "2026", date(2026, 1, 1), date(2026, 12, 31),
                        5.0, 5.5, 4.8, 0, 12, False)
        level, _ = ICRPLimits.evaluate_annual(s)
        self.assertEqual(level, "notification")

    def test_evaluate_investigation(self):
        from src.domain.dose import DoseSummary
        s = DoseSummary("w", "2026", date(2026, 1, 1), date(2026, 12, 31),
                        12.0, 13.0, 11.0, 0, 12, False)
        level, _ = ICRPLimits.evaluate_annual(s)
        self.assertEqual(level, "investigation")

    def test_evaluate_exceeded(self):
        from src.domain.dose import DoseSummary
        s = DoseSummary("w", "2026", date(2026, 1, 1), date(2026, 12, 31),
                        22.0, 23.0, 21.0, 0, 12, False)
        level, _ = ICRPLimits.evaluate_annual(s)
        self.assertEqual(level, "exceeded")


class TestHeuristicAnomalyDetector(unittest.TestCase):
    def setUp(self):
        self.detector = HeuristicAnomalyDetector()

    def _hist(self, doses):
        return [
            _reading(
                period_start=date(2025, m + 1, 1),
                period_end=date(2025, m + 1, 28),
                hp10_msv=d,
            )
            for m, d in enumerate(doses)
        ]

    def test_normal_reading_no_anomaly(self):
        history = self._hist([0.3, 0.35, 0.28, 0.31, 0.29, 0.33, 0.30])
        current = _reading(hp10_msv=0.32)
        r = self.detector.evaluate(current, history)
        self.assertFalse(r.is_anomaly)

    def test_high_dose_over_investigation_threshold(self):
        history = self._hist([0.3, 0.35])
        current = _reading(hp10_msv=1.5)
        r = self.detector.evaluate(current, history)
        self.assertTrue(r.is_anomaly)
        self.assertEqual(r.rule_id, "R1-monthly-investigation")

    def test_baseline_exceeded(self):
        history = self._hist([0.3, 0.35, 0.28, 0.31, 0.29, 0.33])
        current = _reading(hp10_msv=0.95)  # bajo umbral absoluto pero 3× baseline
        r = self.detector.evaluate(current, history)
        self.assertTrue(r.is_anomaly)
        self.assertEqual(r.rule_id, "R2-baseline-exceeded")

    def test_abrupt_jump(self):
        # Baseline heterogéneo -> R2 no dispara, pero salto sí
        history = self._hist([0.05] * 6)
        current = _reading(hp10_msv=0.4)
        r = self.detector.evaluate(current, history)
        self.assertTrue(r.is_anomaly)

    def test_zero_streak_cat_a(self):
        history = self._hist([0, 0, 0, 0])
        current = _reading(hp10_msv=0)
        r = self.detector.evaluate(current, history, worker_category="A")
        self.assertTrue(r.is_anomaly)
        self.assertEqual(r.rule_id, "R4-zero-streak-cat-a")

    def test_zero_streak_cat_b_not_anomaly(self):
        history = self._hist([0, 0, 0, 0])
        current = _reading(hp10_msv=0)
        r = self.detector.evaluate(current, history, worker_category="B")
        self.assertFalse(r.is_anomaly)


class TestIsolationForestDetector(unittest.TestCase):
    def test_ml_flags_outlier(self):
        detector = IsolationForestDetector(contamination=0.1)
        # 20 lecturas normales alrededor de 0.3 mSv
        normals = [_reading(hp10_msv=0.3 + i * 0.005) for i in range(20)]
        detector.fit(normals)
        outlier = _reading(hp10_msv=15.0)
        result = detector.evaluate(outlier)
        # Con solo 20 muestras normales muy densas, IsolationForest debería marcar 15 mSv
        self.assertTrue(result.is_anomaly)

    def test_ml_below_min_samples_disabled(self):
        detector = IsolationForestDetector(min_samples=50)
        detector.fit([_reading(hp10_msv=0.3) for _ in range(10)])
        result = detector.evaluate(_reading(hp10_msv=10))
        self.assertFalse(result.is_anomaly)


class TestCombinedDetector(unittest.TestCase):
    def test_heuristic_takes_precedence(self):
        detector = CombinedAnomalyDetector(
            heuristic=HeuristicAnomalyDetector(monthly_investigation_threshold_msv=1.0),
            ml=IsolationForestDetector(),
        )
        history = [_reading(hp10_msv=0.3) for _ in range(15)]
        detector.fit(history)
        current = _reading(hp10_msv=1.2)
        r = detector.evaluate(current, history)
        self.assertTrue(r.is_anomaly)
        self.assertIn("R1", r.rule_id or "")


class TestParsers(unittest.TestCase):
    def test_generic_csv(self):
        csv = (
            "RUT,Nombre,Codigo_Dosimetro,Periodo_Inicio,Periodo_Fin,Hp(10),Hp(0.07)\n"
            "17.245.892-0,Javiera Muñoz,LD-45678,2026-06-01,2026-06-30,0.32,0.35\n"
            "18.123.456-3,Marcelo Rojas,LD-45679,2026-06-01,2026-06-30,0.28,0.31\n"
        )
        records = list(parse_generic_csv(csv))
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0].worker_national_id, "17.245.892-0")
        self.assertAlmostEqual(records[0].hp10_msv, 0.32)
        self.assertEqual(records[0].period_start, date(2026, 6, 1))

    def test_delimiter_autodetection(self):
        csv = "RUT;Nombre;Hp10\n17.245.892-0;Javiera;0.4\n"
        records = list(parse_generic_csv(csv))
        self.assertEqual(len(records), 1)
        self.assertAlmostEqual(records[0].hp10_msv, 0.4)

    def test_ltr_treated_as_zero(self):
        csv = "RUT,Hp10\n17.245.892-0,LTR\n"
        records = list(parse_generic_csv(csv))
        self.assertAlmostEqual(records[0].hp10_msv, 0.0)

    def test_comma_decimal(self):
        csv = "RUT,Hp10\n17.245.892-0,\"1,25\"\n"
        records = list(parse_generic_csv(csv))
        self.assertAlmostEqual(records[0].hp10_msv, 1.25)

    def test_missing_column_flagged(self):
        csv = "RUT,Nombre\n17.245.892-0,Javiera\n"
        records = list(parse_generic_csv(csv))
        self.assertIsNotNone(records[0].parse_errors)
        self.assertTrue(any("Hp(10)" in e for e in records[0].parse_errors))

    def test_empty_lines_skipped(self):
        csv = "RUT,Hp10\n17.245.892-0,0.5\n\n\n18.123.456-3,0.3\n"
        records = list(parse_generic_csv(csv))
        self.assertEqual(len(records), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
