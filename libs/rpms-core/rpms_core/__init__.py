"""rpms-core — tipos, validadores y utilidades compartidas por todos los servicios."""

from .identifiers import new_uuid, is_uuid
from .rut import validate_rut, format_rut, normalize_rut
from .errors import (
    RPMSError,
    NotFoundError,
    ValidationError,
    ConflictError,
    UnauthorizedError,
    RegulatoryError,
)
from .clock import Clock, SystemClock, FrozenClock
from .events import DomainEvent, EventBus

__all__ = [
    "new_uuid",
    "is_uuid",
    "validate_rut",
    "format_rut",
    "normalize_rut",
    "RPMSError",
    "NotFoundError",
    "ValidationError",
    "ConflictError",
    "UnauthorizedError",
    "RegulatoryError",
    "Clock",
    "SystemClock",
    "FrozenClock",
    "DomainEvent",
    "EventBus",
]

__version__ = "0.1.0"
