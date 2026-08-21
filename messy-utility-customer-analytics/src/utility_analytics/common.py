"""Shared paths and helpers for the utility analytics project."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
BRONZE_DIR = DATA_DIR / "bronze"
SILVER_DIR = DATA_DIR / "silver"
GOLD_DIR = DATA_DIR / "gold"
QUARANTINE_DIR = DATA_DIR / "quarantine"
REPORTS_DIR = DATA_DIR / "reports"


def ensure_directories() -> None:
    """Create the runtime data directories."""

    for directory in [RAW_DIR, BRONZE_DIR, SILVER_DIR, GOLD_DIR, QUARANTINE_DIR, REPORTS_DIR]:
        directory.mkdir(parents=True, exist_ok=True)


def write_frame(frame: pl.DataFrame, path: Path) -> None:
    """Write a Polars frame using the file suffix."""

    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".csv":
        frame.write_csv(path)
    elif path.suffix.lower() == ".parquet":
        frame.write_parquet(path)
    else:
        raise ValueError(f"Unsupported frame format: {path.suffix}")


def safe_int(value: Any, default: int = 0) -> int:
    """Convert a value to int with a fallback."""

    try:
        return int(value)
    except (TypeError, ValueError):
        return default
