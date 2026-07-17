"""Platform connectors: normalize vendor payloads into the canonical RunEventIn."""
from datetime import datetime


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
