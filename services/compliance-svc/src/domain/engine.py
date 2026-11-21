"""Motor de reglas de cumplimiento regulatorio.

Diseño:
- Reglas declarativas en YAML/JSON (aquí Python nativo para no depender de PyYAML).
- Cada regla define condiciones sobre entidades y una acción.
- Trazabilidad: cada evaluación produce un `ComplianceFinding` con
  rule_id, entity, severity, message, jurisdiction.
- Determinista y auditable: dado el mismo estado, la misma salida.
- Multi-jurisdicción: cada regla lleva su `jurisdiction`.

En producción: reglas persistidas en tabla `compliance_rule` versionada,
con `valid_from`/`valid_to` para poder simular reglas propuestas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any, Callable, Optional


class Severity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass(frozen=True)
class ComplianceFinding:
    """Hallazgo producido por la evaluación de una regla."""

    rule_id: str
    severity: Severity
    message: str
    jurisdiction: str
    entity_type: str
    entity_id: str
    reference_norm: Optional[str] = None
    suggested_action: Optional[str] = None
    due_date: Optional[date] = None


@dataclass
class Rule:
    """Regla declarativa evaluable contra un contexto."""

    id: str
    jurisdiction: str
    severity: Severity
    message_template: str
    entity_type: str
    predicate: Callable[[Any, "EvaluationContext"], bool]
    reference_norm: Optional[str] = None
    suggested_action_template: Optional[str] = None
    due_date_extractor: Optional[Callable[[Any, "EvaluationContext"], Optional[date]]] = None
    valid_from: date = field(default_factory=lambda: date(2020, 1, 1))
    valid_to: Optional[date] = None

    def applies_on(self, on_date: date) -> bool:
        if on_date < self.valid_from:
            return False
        if self.valid_to and on_date > self.valid_to:
            return False
        return True

    def evaluate(self, entity: Any, ctx: "EvaluationContext") -> Optional[ComplianceFinding]:
        if not self.applies_on(ctx.on_date):
            return None
        try:
            triggered = self.predicate(entity, ctx)
        except Exception as e:
            # Una regla nunca debe romper el pipeline
            return ComplianceFinding(
                rule_id=self.id,
                severity=Severity.LOW,
                message=f"Error evaluando regla {self.id}: {e}",
                jurisdiction=self.jurisdiction,
                entity_type=self.entity_type,
                entity_id=getattr(entity, "id", "unknown"),
            )
        if not triggered:
            return None

        # Renderiza el mensaje con atributos del entity
        try:
            msg = self.message_template.format(entity=entity, ctx=ctx)
        except Exception:
            msg = self.message_template

        action = None
        if self.suggested_action_template:
            try:
                action = self.suggested_action_template.format(entity=entity, ctx=ctx)
            except Exception:
                action = self.suggested_action_template

        due = None
        if self.due_date_extractor:
            try:
                due = self.due_date_extractor(entity, ctx)
            except Exception:
                due = None

        return ComplianceFinding(
            rule_id=self.id,
            severity=self.severity,
            message=msg,
            jurisdiction=self.jurisdiction,
            entity_type=self.entity_type,
            entity_id=getattr(entity, "id", "unknown"),
            reference_norm=self.reference_norm,
            suggested_action=action,
            due_date=due,
        )


@dataclass
class EvaluationContext:
    """Contexto que las reglas pueden consultar durante la evaluación."""

    tenant_id: str
    on_date: date
    # Referencias cruzadas (cargadas por la aplicación previo a evaluar):
    authorizations_by_worker: dict[str, list] = field(default_factory=dict)
    dose_readings_by_worker: dict[str, list] = field(default_factory=dict)
    licenses_by_subject: dict[str, list] = field(default_factory=dict)
    trainings_by_worker: dict[str, list] = field(default_factory=dict)


class RuleEngine:
    """Motor que evalúa un conjunto de reglas contra entidades."""

    def __init__(self, rules: Optional[list[Rule]] = None):
        self.rules: list[Rule] = list(rules or [])

    def register(self, rule: Rule) -> None:
        self.rules.append(rule)

    def evaluate(
        self,
        entities: dict[str, list],
        ctx: EvaluationContext,
    ) -> list[ComplianceFinding]:
        """Evalúa todas las reglas contra las entidades del contexto.

        Args:
            entities: {entity_type: [entities]}
            ctx: contexto compartido
        """
        findings: list[ComplianceFinding] = []
        for rule in self.rules:
            candidates = entities.get(rule.entity_type, [])
            for entity in candidates:
                f = rule.evaluate(entity, ctx)
                if f is not None:
                    findings.append(f)
        return findings

    def evaluate_summary(self, findings: list[ComplianceFinding]) -> dict:
        """Devuelve conteos por severidad y jurisdicción."""
        by_severity: dict[str, int] = {}
        by_jurisdiction: dict[str, int] = {}
        for f in findings:
            by_severity[f.severity.value] = by_severity.get(f.severity.value, 0) + 1
            by_jurisdiction[f.jurisdiction] = by_jurisdiction.get(f.jurisdiction, 0) + 1
        return {
            "total": len(findings),
            "by_severity": by_severity,
            "by_jurisdiction": by_jurisdiction,
        }
