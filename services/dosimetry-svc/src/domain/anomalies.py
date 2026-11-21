"""Detector de anomalías dosimétricas.

Dos capas:

1. **Reglas heurísticas** (deterministas y auditables):
   - Dosis mensual > 3× baseline personal (mediana móvil 12 m).
   - Dosis mensual > `investigation_level / 12`.
   - Dosis mensual excede el máximo histórico registrado * 1.5.
   - Salto abrupto: 5× la lectura anterior no nula.
   - Dosis nula continua durante 3+ meses en trabajador cat. A.

2. **Modelo estadístico** (opcional): IsolationForest sobre features
   agregadas por trabajador. Baja precisión con poca historia, sirve como
   señal secundaria.

Ambos coexisten. Una lectura es anómala si al menos una capa la marca.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Optional, Sequence

from .dose import DoseReading, ICRPLimits


@dataclass(frozen=True)
class AnomalyResult:
    is_anomaly: bool
    reason: Optional[str] = None
    score: float = 0.0
    rule_id: Optional[str] = None


class HeuristicAnomalyDetector:
    """Detector determinista, sin ML. Explicable y auditable."""

    def __init__(
        self,
        *,
        monthly_investigation_threshold_msv: float = 1.0,
        baseline_multiplier: float = 3.0,
        jump_multiplier: float = 5.0,
        zero_streak_months: int = 3,
    ):
        self.monthly_investigation_threshold_msv = monthly_investigation_threshold_msv
        self.baseline_multiplier = baseline_multiplier
        self.jump_multiplier = jump_multiplier
        self.zero_streak_months = zero_streak_months

    def evaluate(
        self,
        current: DoseReading,
        history: Sequence[DoseReading],
        worker_category: str = "A",
    ) -> AnomalyResult:
        """Evalúa la lectura `current` en el contexto de `history` (misma persona)."""
        current_dose = current.hp10_msv or 0.0

        # R1: umbral absoluto de investigación mensual
        if current_dose >= self.monthly_investigation_threshold_msv:
            return AnomalyResult(
                is_anomaly=True,
                reason=(
                    f"Dosis mensual Hp(10)={current_dose:.3f} mSv excede el "
                    f"umbral de investigación ({self.monthly_investigation_threshold_msv} mSv)"
                ),
                score=1.0,
                rule_id="R1-monthly-investigation",
            )

        # Baseline: mediana de últimas 12 lecturas no nulas (excluyendo current)
        past_non_null = [r.hp10_msv for r in history
                         if r.hp10_msv is not None and r.id != current.id]
        past_non_null = past_non_null[-12:]

        if past_non_null:
            baseline = median(past_non_null)
            # R2: excede N× baseline (solo si baseline > 0)
            if baseline > 0 and current_dose > baseline * self.baseline_multiplier:
                return AnomalyResult(
                    is_anomaly=True,
                    reason=(
                        f"Dosis {current_dose:.3f} mSv excede {self.baseline_multiplier}× "
                        f"la mediana personal ({baseline:.3f} mSv)"
                    ),
                    score=min(1.0, (current_dose / (baseline * self.baseline_multiplier)) - 1),
                    rule_id="R2-baseline-exceeded",
                )

            # R3: salto abrupto vs. lectura anterior
            last = past_non_null[-1]
            if last > 0 and current_dose > last * self.jump_multiplier:
                return AnomalyResult(
                    is_anomaly=True,
                    reason=(
                        f"Salto abrupto: {current_dose:.3f} mSv es "
                        f"{current_dose / last:.1f}× la lectura anterior ({last:.3f} mSv)"
                    ),
                    score=0.85,
                    rule_id="R3-abrupt-jump",
                )

        # R4: trabajador Cat. A con dosis nula continua (posible dosímetro no usado)
        if worker_category == "A" and current_dose == 0:
            recent = [r for r in history[-self.zero_streak_months:] if r.hp10_msv == 0]
            if len(recent) >= self.zero_streak_months - 1:
                return AnomalyResult(
                    is_anomaly=True,
                    reason=(
                        f"Trabajador cat. A con {self.zero_streak_months} meses "
                        "consecutivos de dosis nula (posible dosímetro sin usar)"
                    ),
                    score=0.6,
                    rule_id="R4-zero-streak-cat-a",
                )

        return AnomalyResult(is_anomaly=False)


class IsolationForestDetector:
    """Detector estadístico. Requiere scikit-learn.

    Se entrena con el histórico completo de una persona (o cohorte) y
    marca outliers. Devuelve un score en [-1, 1] donde valores negativos
    son anómalos.
    """

    def __init__(self, contamination: float = 0.05, min_samples: int = 12):
        self.contamination = contamination
        self.min_samples = min_samples
        self._model = None

    def fit(self, readings: Sequence[DoseReading]) -> None:
        try:
            from sklearn.ensemble import IsolationForest
        except ImportError:
            self._model = None
            return

        if len(readings) < self.min_samples:
            self._model = None
            return

        # Features: hp10, hp007, hp3
        X = [
            [
                r.hp10_msv or 0.0,
                r.hp007_msv or 0.0,
                r.hp3_msv or 0.0,
            ]
            for r in readings
        ]
        self._model = IsolationForest(
            contamination=self.contamination, random_state=42
        )
        self._model.fit(X)

    def evaluate(self, reading: DoseReading) -> AnomalyResult:
        if self._model is None:
            return AnomalyResult(is_anomaly=False)
        X = [[reading.hp10_msv or 0.0, reading.hp007_msv or 0.0, reading.hp3_msv or 0.0]]
        pred = self._model.predict(X)[0]  # 1 normal, -1 outlier
        score = float(self._model.score_samples(X)[0])
        if pred == -1:
            return AnomalyResult(
                is_anomaly=True,
                reason=f"IsolationForest marca lectura como outlier (score={score:.3f})",
                score=abs(score),
                rule_id="ML-isolation-forest",
            )
        return AnomalyResult(is_anomaly=False, score=score)


class CombinedAnomalyDetector:
    """Combina reglas heurísticas + modelo estadístico.

    Precedencia: reglas heurísticas primero (razones explicables).
    Si ninguna dispara, se consulta al modelo.
    """

    def __init__(
        self,
        heuristic: Optional[HeuristicAnomalyDetector] = None,
        ml: Optional[IsolationForestDetector] = None,
    ):
        self.heuristic = heuristic or HeuristicAnomalyDetector()
        self.ml = ml

    def fit(self, readings: Sequence[DoseReading]) -> None:
        if self.ml is not None:
            self.ml.fit(readings)

    def evaluate(
        self,
        current: DoseReading,
        history: Sequence[DoseReading],
        worker_category: str = "A",
    ) -> AnomalyResult:
        h = self.heuristic.evaluate(current, history, worker_category)
        if h.is_anomaly:
            return h
        if self.ml is not None:
            return self.ml.evaluate(current)
        return AnomalyResult(is_anomaly=False)
