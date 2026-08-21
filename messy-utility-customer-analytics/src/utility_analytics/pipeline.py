"""Pipeline orchestration entry point."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import polars as pl

from utility_analytics.analytics import build_gold_analytics
from utility_analytics.anomaly import detect_anomalies
from utility_analytics.common import (
    BRONZE_DIR,
    GOLD_DIR,
    QUARANTINE_DIR,
    RAW_DIR,
    REPORTS_DIR,
    SILVER_DIR,
    ensure_directories,
    write_frame,
)
from utility_analytics.normalization import normalize_sources
from utility_analytics.quality import assess_quality
from utility_analytics.reconciliation import load_tariffs, reconcile_bills
from utility_analytics.synthetic import generate_synthetic_data


def _load_sources(raw_dir: Path) -> dict[str, pl.DataFrame]:
    with (raw_dir / "service_requests.json").open("r", encoding="utf-8") as handle:
        service_requests = json.load(handle)

    return {
        "customers": pl.read_csv(raw_dir / "customers.csv"),
        "meters": pl.read_csv(raw_dir / "meters.csv"),
        "meter_readings": pl.read_csv(raw_dir / "meter_readings.csv"),
        "billing": pl.read_csv(raw_dir / "billing.csv"),
        "service_requests": pl.DataFrame(service_requests),
    }


def run_pipeline(seed: int = 42) -> dict[str, object]:
    """Run the local-first MVP pipeline and return the main outputs."""

    ensure_directories()
    generate_synthetic_data(seed=seed)

    raw_sources = _load_sources(RAW_DIR)
    for name, frame in raw_sources.items():
        write_frame(frame, BRONZE_DIR / f"{name}.parquet")

    normalized = normalize_sources(raw_sources)

    for name, frame in normalized.items():
        write_frame(frame, SILVER_DIR / f"{name}.parquet")

    quality = assess_quality(normalized)
    write_frame(quality["issues"], QUARANTINE_DIR / "quality_issues.parquet")
    write_frame(quality["quarantine"], QUARANTINE_DIR / "quarantine.parquet")
    write_frame(quality["summary"], GOLD_DIR / "quality_summary.parquet")

    tariffs = load_tariffs(RAW_DIR / "tariffs.xlsx")
    reconciliation = reconcile_bills(
        normalized["customers"],
        normalized["meters"],
        normalized["meter_readings"],
        normalized["billing"],
        tariffs,
    )
    write_frame(reconciliation, GOLD_DIR / "billing_reconciliation.parquet")

    anomalies = detect_anomalies(normalized["meter_readings"], reconciliation, quality["issues"])
    write_frame(anomalies, GOLD_DIR / "customer_anomalies.parquet")

    outputs = build_gold_analytics(
        normalized["customers"],
        normalized["meters"],
        normalized["meter_readings"],
        normalized["billing"],
        reconciliation,
        anomalies,
    )

    summary = {
        "raw_dir": str(RAW_DIR),
        "bronze_dir": str(BRONZE_DIR),
        "silver_dir": str(SILVER_DIR),
        "gold_dir": str(GOLD_DIR),
        "quarantine_dir": str(QUARANTINE_DIR),
        "quality_issues": quality["issues"].height,
        "unreconciled_bills": outputs["answer_5_unreconciled_bills"][0, 0],
        "anomalous_customers": outputs["answer_1_abnormal_customers"].height,
        "top_20_anomalous_customers": outputs["top_20_anomalous_customers"],
    }
    (REPORTS_DIR / "run_summary.json").write_text(
        json.dumps(
            {
                **{key: value for key, value in summary.items() if key != "top_20_anomalous_customers"},
                "seed": seed,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return summary
