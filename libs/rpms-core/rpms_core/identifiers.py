"""Generación y validación de identificadores UUID."""

from __future__ import annotations

import re
import uuid

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def new_uuid() -> str:
    """Genera un UUIDv4 en formato string canónico."""
    return str(uuid.uuid4())


def is_uuid(value: str) -> bool:
    """Devuelve True si `value` es un UUID v1-5 válido."""
    if not isinstance(value, str):
        return False
    return bool(_UUID_RE.match(value))
