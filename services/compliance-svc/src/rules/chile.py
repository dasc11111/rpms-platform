"""Reglas regulatorias chilenas (DS 133/1984, DS 3/1985, DS 594/1999).

Cada regla es una instancia de Rule del engine. Las reglas están agrupadas
por norma para facilitar auditoría y actualización.

Fuente normativa: docs/regulatory/chile.md
"""

from __future__ import annotations

from datetime import date, timedelta

from ..domain.engine import EvaluationContext, Rule, Severity


# =====================================================================
# DS 133/1984 - Autorizaciones para instalaciones y equipos
# =====================================================================


def _equipment_missing_operation_license(equipment, ctx: EvaluationContext) -> bool:
    if getattr(equipment, "status", None) == "decommissioned":
        return False
    licenses = ctx.licenses_by_subject.get(equipment.id, [])
    active_ops = [
        l for l in licenses
        if l.license_type == "operation" and l.status == "active"
    ]
    return len(active_ops) == 0


rule_ds133_equipment_operation = Rule(
    id="CL-DS133-EQUIPO-AUTORIZACION",
    jurisdiction="CL",
    severity=Severity.CRITICAL,
    message_template=(
        "Equipo {entity.manufacturer} {entity.model} (S/N {entity.serial_number}) "
        "requiere autorización de operación vigente (DS 133/1984)."
    ),
    entity_type="equipment",
    predicate=_equipment_missing_operation_license,
    reference_norm="DS 133/1984, Art. 4",
    suggested_action_template=(
        "Iniciar trámite de autorización con SEREMI de Salud. "
        "El equipo no puede operar sin este documento."
    ),
)


# =====================================================================
# DS 3/1985 - Protección radiológica: dosimetría personal obligatoria
# =====================================================================


def _worker_cat_a_missing_monthly_dosimetry(worker, ctx: EvaluationContext) -> bool:
    if worker.status.value != "active":
        return False
    if worker.icrp_category.value != "A":
        return False
    # Verificar que hay lectura del mes anterior completo
    ref = ctx.on_date
    # Primer día del mes anterior
    if ref.month == 1:
        prev_month_start = date(ref.year - 1, 12, 1)
        prev_month_end = date(ref.year - 1, 12, 31)
    else:
        prev_month_start = date(ref.year, ref.month - 1, 1)
        # último día del mes anterior
        prev_month_end = date(ref.year, ref.month, 1) - timedelta(days=1)

    readings = ctx.dose_readings_by_worker.get(worker.id, [])
    covered = any(
        r.period_start <= prev_month_end and r.period_end >= prev_month_start
        for r in readings
    )
    return not covered


rule_ds3_worker_monthly_dosimetry = Rule(
    id="CL-DS3-DOSIMETRO-MENSUAL",
    jurisdiction="CL",
    severity=Severity.HIGH,
    message_template=(
        "Trabajador {entity.full_name} (categoría A) sin lectura dosimétrica "
        "del mes anterior — DS 3/1985."
    ),
    entity_type="worker",
    predicate=_worker_cat_a_missing_monthly_dosimetry,
    reference_norm="DS 3/1985, Art. 8",
    suggested_action_template=(
        "Verificar entrega del dosímetro al proveedor y reingreso de lectura."
    ),
)


def _worker_cat_a_missing_authorization(worker, ctx: EvaluationContext) -> bool:
    if worker.status.value != "active":
        return False
    if worker.icrp_category.value != "A":
        return False
    auths = ctx.authorizations_by_worker.get(worker.id, [])
    active_auths = [
        a for a in auths
        if a.status.value == "active"
        and (a.expires_at is None or a.expires_at >= ctx.on_date)
    ]
    return len(active_auths) == 0


rule_ds3_worker_authorization_required = Rule(
    id="CL-DS3-TRABAJADOR-AUTORIZACION",
    jurisdiction="CL",
    severity=Severity.CRITICAL,
    message_template=(
        "Trabajador {entity.full_name} (categoría A) sin autorización vigente."
    ),
    entity_type="worker",
    predicate=_worker_cat_a_missing_authorization,
    reference_norm="DS 3/1985 y DS 133/1984",
    suggested_action_template=(
        "El trabajador debe suspender labores con exposición hasta obtener "
        "la autorización de operador correspondiente."
    ),
)


def _authorization_expiring_soon(auth, ctx: EvaluationContext) -> bool:
    if auth.status.value != "active":
        return False
    if auth.expires_at is None:
        return False
    days_left = (auth.expires_at - ctx.on_date).days
    return 0 <= days_left <= 90


def _auth_due_date(auth, ctx: EvaluationContext):
    return auth.expires_at


rule_authorization_expiring = Rule(
    id="CL-GEN-AUTORIZACION-POR-VENCER",
    jurisdiction="CL",
    severity=Severity.MEDIUM,
    message_template=(
        "Autorización {entity.number} vence el {entity.expires_at}. "
        "Iniciar renovación con anticipación."
    ),
    entity_type="authorization",
    predicate=_authorization_expiring_soon,
    reference_norm="Práctica operativa",
    suggested_action_template="Generar solicitud de renovación con SEREMI.",
    due_date_extractor=_auth_due_date,
)


# =====================================================================
# Calibración de instrumentos (buena práctica + normativa ISP)
# =====================================================================


def _instrument_calibration_overdue(instrument, ctx: EvaluationContext) -> bool:
    if instrument.status != "active":
        return False
    nxt = instrument.next_calibration_at
    if nxt is None:
        return True  # nunca calibrado — hallazgo
    # Comparar con on_date (str en formato ISO o date)
    if isinstance(nxt, str):
        try:
            nxt = date.fromisoformat(nxt[:10])
        except ValueError:
            return False
    return nxt < ctx.on_date


rule_instrument_calibration_overdue = Rule(
    id="CL-ISP-INSTRUMENTO-CALIBRACION",
    jurisdiction="CL",
    severity=Severity.HIGH,
    message_template=(
        "Instrumento {entity.manufacturer} {entity.model} (S/N {entity.serial_number}) "
        "requiere calibración vencida."
    ),
    entity_type="instrument",
    predicate=_instrument_calibration_overdue,
    reference_norm="Resoluciones ISP y GSR Part 3",
    suggested_action_template="Enviar a laboratorio de calibración acreditado.",
)


# =====================================================================
# Registro de reglas por jurisdicción
# =====================================================================

CHILE_RULES = [
    rule_ds133_equipment_operation,
    rule_ds3_worker_monthly_dosimetry,
    rule_ds3_worker_authorization_required,
    rule_authorization_expiring,
    rule_instrument_calibration_overdue,
]


def get_rules_for_jurisdiction(country_code: str) -> list[Rule]:
    """Devuelve el paquete de reglas para una jurisdicción."""
    if country_code.upper() == "CL":
        return list(CHILE_RULES)
    return []
