"""Consumption anomaly detection."""

from __future__ import annotations

import polars as pl


def detect_anomalies(
    readings: pl.DataFrame,
    reconciliation: pl.DataFrame,
    quality_issues: pl.DataFrame,
) -> pl.DataFrame:
    """Score customer consumption anomalies using simple local rules."""

    monthly = readings.with_columns(pl.col("canonical_reading_date").str.slice(0, 7).alias("billing_period")).group_by(
        ["canonical_customer_id", "billing_period"]
    ).agg(pl.col("consumption_kwh").sum().alias("monthly_consumption"))

    latest = monthly.sort(["canonical_customer_id", "billing_period"]).group_by("canonical_customer_id").tail(1)
    previous = monthly.sort(["canonical_customer_id", "billing_period"]).group_by("canonical_customer_id").tail(2).group_by(
        "canonical_customer_id"
    ).agg(pl.col("monthly_consumption").first().alias("previous_consumption"))

    scores = latest.join(previous, on="canonical_customer_id", how="left")
    scores = scores.with_columns(
        pl.when(pl.col("previous_consumption").is_not_null() & (pl.col("previous_consumption") != 0))
        .then((pl.col("monthly_consumption") - pl.col("previous_consumption")) / pl.col("previous_consumption") * 100)
        .otherwise(None)
        .alias("growth_pct")
    )

    stats = monthly.group_by("canonical_customer_id").agg(
        pl.col("monthly_consumption").mean().alias("mean_consumption"),
        pl.col("monthly_consumption").std().alias("std_consumption"),
    )
    scores = scores.join(stats, on="canonical_customer_id", how="left")
    scores = scores.with_columns(
        pl.when(pl.col("std_consumption").fill_null(0) > 0)
        .then((pl.col("monthly_consumption") - pl.col("mean_consumption")) / pl.col("std_consumption"))
        .otherwise(pl.lit(0.0))
        .alias("z_score")
    )

    reading_issue_counts = (
        quality_issues.filter(pl.col("dataset") == "meter_readings")
        .join(readings.select("canonical_meter_id", "canonical_customer_id"), left_on="record_id", right_on="canonical_meter_id", how="left")
        .group_by("canonical_customer_id")
        .len()
        .rename({"len": "quality_issue_count"})
        if not quality_issues.is_empty()
        else pl.DataFrame({"canonical_customer_id": [], "quality_issue_count": []})
    )

    billing_mismatches = reconciliation.filter(pl.col("reconciliation_status") != "MATCH").group_by("canonical_customer_id").len().rename(
        {"len": "billing_mismatch_count"}
    )

    scores = scores.join(reading_issue_counts, on="canonical_customer_id", how="left").join(
        billing_mismatches, on="canonical_customer_id", how="left"
    )
    scores = scores.with_columns(
        pl.col("quality_issue_count").fill_null(0),
        pl.col("billing_mismatch_count").fill_null(0),
    )

    scores = scores.with_columns(
        (
            pl.col("z_score").abs().clip(0, 6) / 6 * 0.45
            + pl.col("growth_pct").abs().fill_null(0).clip(0, 300) / 300 * 0.35
            + pl.col("quality_issue_count").clip(0, 5) / 5 * 0.1
            + pl.col("billing_mismatch_count").clip(0, 5) / 5 * 0.1
        ).alias("anomaly_score")
    )

    scores = scores.with_columns(
        pl.when(pl.col("anomaly_score") >= 0.65).then(pl.lit("HIGH_VOLATILITY"))
        .when(pl.col("billing_mismatch_count") > 0).then(pl.lit("BILLING_MISMATCH"))
        .when(pl.col("growth_pct").abs() >= 150).then(pl.lit("GROWTH_SPIKE"))
        .otherwise(pl.lit("NORMAL"))
        .alias("anomaly_reason"),
        (pl.col("anomaly_score") >= 0.65).alias("is_anomalous"),
    )

    return scores.sort("anomaly_score", descending=True)
