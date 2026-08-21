"""Gold-layer analytics for the final business questions."""

from __future__ import annotations

from pathlib import Path

import polars as pl

from utility_analytics.common import GOLD_DIR, write_frame


def build_gold_analytics(
    customers: pl.DataFrame,
    readings: pl.DataFrame,
    billing: pl.DataFrame,
    reconciliation: pl.DataFrame,
    anomalies: pl.DataFrame,
    output_dir: Path | None = None,
) -> dict[str, pl.DataFrame]:
    """Build business-ready outputs for the final questions."""

    gold_dir = output_dir or GOLD_DIR
    gold_dir.mkdir(parents=True, exist_ok=True)

    monthly = readings.with_columns(pl.col("canonical_reading_date").str.slice(0, 7).alias("billing_period")).group_by(
        ["canonical_customer_id", "billing_period"]
    ).agg(pl.col("consumption_kwh").sum().alias("consumption_kwh"))
    monthly = monthly.join(
        customers.select("canonical_customer_id", "normalized_location", "customer_category"),
        on="canonical_customer_id",
        how="left",
    ).with_columns(
        pl.col("normalized_location").fill_null("UNKNOWN"),
        pl.col("customer_category").fill_null("UNKNOWN"),
    )

    region_consumption = monthly.group_by("normalized_location").agg(pl.col("consumption_kwh").sum().alias("total_consumption_kwh")).sort(
        "total_consumption_kwh", descending=True
    )

    category_monthly = monthly.group_by(["customer_category", "billing_period"]).agg(
        pl.col("consumption_kwh").sum().alias("consumption_kwh")
    )
    category_growth = category_monthly.sort(["customer_category", "billing_period"]).group_by(
        "customer_category"
    ).agg(
        pl.col("consumption_kwh").tail(2).alias("recent_consumption_kwh")
    ).with_columns(
        pl.col("recent_consumption_kwh").list.get(0).alias("previous_consumption_kwh"),
        pl.col("recent_consumption_kwh").list.get(-1).alias("current_consumption_kwh"),
    ).drop("recent_consumption_kwh").with_columns(
        pl.when(pl.col("previous_consumption_kwh").fill_null(0) != 0)
        .then((pl.col("current_consumption_kwh") - pl.col("previous_consumption_kwh")) / pl.col("previous_consumption_kwh") * 100)
        .otherwise(None)
        .alias("growth_pct")
    ).sort("growth_pct", descending=True)

    reading_quality = readings.group_by("canonical_customer_id").agg(
        pl.col("consumption_kwh").null_count().alias("missing_readings"),
        (pl.col("consumption_kwh") < 0).sum().alias("suspicious_readings"),
    )

    bill_reconciliation = reconciliation.select(
        "bill_id",
        "canonical_customer_id",
        "canonical_meter_id",
        "canonical_billing_period",
        "meter_consumption_kwh",
        "expected_amount",
        "actual_amount",
        "difference",
        "difference_pct",
        "reconciliation_status",
    )

    customer_anomalies = anomalies.select(
        "canonical_customer_id",
        "billing_period",
        "monthly_consumption",
        "growth_pct",
        "quality_issue_count",
        "billing_mismatch_count",
        "anomaly_score",
        "anomaly_reason",
        "is_anomalous",
    )

    outputs = {
        "gold_customer_consumption": monthly,
        "gold_region_consumption": region_consumption,
        "gold_category_growth": category_growth,
        "gold_reading_quality": reading_quality,
        "gold_billing_reconciliation": bill_reconciliation,
        "gold_customer_anomalies": customer_anomalies,
        "top_20_anomalous_customers": anomalies.head(20),
        "answer_1_abnormal_customers": anomalies.filter(pl.col("is_anomalous")).select(
            "canonical_customer_id", "anomaly_score", "anomaly_reason"
        ),
        "answer_2_regions": region_consumption,
        "answer_3_category_growth": category_growth,
        "answer_4_reading_issues": pl.DataFrame(
            {
                "missing_or_suspicious_readings": [
                    readings.filter(pl.col("consumption_kwh").is_null() | (pl.col("consumption_kwh") < 0)).select(
                        pl.col("canonical_customer_id").n_unique()
                    )[0, 0]
                ]
            }
        ),
        "answer_5_unreconciled_bills": pl.DataFrame(
            {
                "unreconciled_bills": [
                    bill_reconciliation.filter(
                        pl.col("bill_id").is_not_null()
                        & (pl.col("reconciliation_status") != "MATCH")
                    ).select("bill_id").n_unique()
                ]
            }
        ),
        "answer_6_top_20_anomalous_customers": anomalies.head(20),
    }

    for name, frame in outputs.items():
        write_frame(frame, gold_dir / f"{name}.csv")

    return outputs
