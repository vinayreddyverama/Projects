"""Command-line entry point for synthetic data generation."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from utility_analytics.synthetic import generate_synthetic_data


if __name__ == "__main__":
    generate_synthetic_data()
