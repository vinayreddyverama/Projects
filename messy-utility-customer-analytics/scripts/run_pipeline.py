"""Run the complete local utility analytics pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from utility_analytics.pipeline import run_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate data and build utility analytics outputs.")
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Seed used by the synthetic generator (default: 42).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = run_pipeline(seed=args.seed)
    print("Pipeline completed successfully.")
    print(f"Quality issues: {summary['quality_issues']}")
    print(f"Unreconciled bills: {summary['unreconciled_bills']}")
    print(f"Anomalous customers: {summary['anomalous_customers']}")
    print(f"Gold outputs: {summary['gold_dir']}")


if __name__ == "__main__":
    main()
