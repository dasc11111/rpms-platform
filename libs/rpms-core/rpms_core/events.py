"""Domain events y bus en memoria.

En producción se reemplaza por adaptador Kafka. En tests el bus in-memory
permite verificar que un caso de uso publica los eventos esperados.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from .identifiers import new_uuid


@dataclass(frozen=True)
class DomainEvent:
    """Evento de dominio base.

    El nombre canónico es dot-notation: 'workforce.worker.created.v1'.
    """

    name: str
    payload: dict[str, Any]
    tenant_id: str
    event_id: str = field(default_factory=new_uuid)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    correlation_id: str | None = None
    causation_id: str | None = None


Handler = Callable[[DomainEvent], None]


class EventBus:
    """Bus síncrono en memoria (para dev/tests). Kafka-backed en producción."""

    def __init__(self) -> None:
        self._subs: dict[str, list[Handler]] = {}
        self.published: list[DomainEvent] = []  # para inspección en tests

    def subscribe(self, event_name: str, handler: Handler) -> None:
        self._subs.setdefault(event_name, []).append(handler)

    def publish(self, event: DomainEvent) -> None:
        self.published.append(event)
        for handler in self._subs.get(event.name, []):
            handler(event)
        # wildcard '*' recibe todo
        for handler in self._subs.get("*", []):
            handler(event)

    def clear(self) -> None:
        self.published.clear()
