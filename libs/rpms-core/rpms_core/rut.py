"""Validación y formateo de RUT chileno (Rol Único Tributario).

Algoritmo:
    1. Se toma el número (sin dígito verificador), se recorren sus dígitos
       de derecha a izquierda multiplicando por 2..7 (ciclando).
    2. Se suma el resultado.
    3. Se calcula: dv = 11 - (suma mod 11).
    4. Si dv == 11 → '0'; si dv == 10 → 'K'; en otro caso → str(dv).
"""

from __future__ import annotations

import re

_CLEAN_RE = re.compile(r"[.\s-]")


def _clean(rut: str) -> str:
    return _CLEAN_RE.sub("", rut).upper()


def compute_dv(number: int) -> str:
    """Calcula el dígito verificador de un RUT numérico."""
    if number <= 0:
        raise ValueError("El RUT debe ser un entero positivo")
    total = 0
    factor = 2
    n = number
    while n > 0:
        total += (n % 10) * factor
        n //= 10
        factor = 2 if factor == 7 else factor + 1
    remainder = total % 11
    dv = 11 - remainder
    if dv == 11:
        return "0"
    if dv == 10:
        return "K"
    return str(dv)


def validate_rut(rut: str) -> bool:
    """Valida un RUT chileno. Acepta formatos con o sin puntos/guion."""
    if not isinstance(rut, str):
        return False
    cleaned = _clean(rut)
    if len(cleaned) < 2 or not re.match(r"^\d+[0-9K]$", cleaned):
        return False
    body, dv = cleaned[:-1], cleaned[-1]
    try:
        return compute_dv(int(body)) == dv
    except ValueError:
        return False


def normalize_rut(rut: str) -> str:
    """Devuelve el RUT sin puntos ni guion, DV en mayúscula. Solo la parte numérica.

    Ej.: '17.245.892-3' -> '172458923'
    """
    if not validate_rut(rut):
        raise ValueError(f"RUT inválido: {rut!r}")
    return _clean(rut)


def format_rut(rut: str) -> str:
    """Formatea con puntos y guion: '17.245.892-3'."""
    if not validate_rut(rut):
        raise ValueError(f"RUT inválido: {rut!r}")
    cleaned = _clean(rut)
    body, dv = cleaned[:-1], cleaned[-1]
    # Insertar puntos cada 3 dígitos desde la derecha
    reversed_body = body[::-1]
    grouped = ".".join(reversed_body[i : i + 3] for i in range(0, len(reversed_body), 3))
    return f"{grouped[::-1]}-{dv}"
