"""Data-quality checks and quarantine handling."""

from __future__ import annotations

import polars as pl


def _issue_rows(dataset: str, issue_type: str, severity: str, reason: str, frame: pl.DataFrame, record_id: str) -> pl.DataFrame:
    if frame.is_empty():
        return pl.DataFrame(schema={"dataset": pl.Utf8, "issue_type": pl.Utf8, "severity": pl.Utf8, "reason": pl.Utf8, "record_id": pl.Utf8})
    return frame.select(
        pl.lit(dataset).alias("dataset"),
        pl.lit(issue_type).alias("issue_type"),
        pl.lit(severity).alias("severity"),
        pl.lit(reason).alias("reason"),
        pl.col(record_id).cast(pl.Utf8).alias("record_id"),
    )


def assess_quality(sources: dict[str, pl.DataFrame], extreme_threshold: float = 3000.0) -> dict[str, pl.DataFrame]:
    """Assess data quality and return issues, quarantine rows, and a summary."""

    customers = sources["customers"]
    meters = sources["meters"]
    readings = sources["meter_readings"]
    billing = sources["billing"]

    issues: list[pl.DataFrame] = []

    duplicate_customers = customers.filter(pl.col("canonical_customer_id").is_duplicated())
    issues.append(_issue_rows("customers", "duplicate_customer", "medium", "Duplicate canonical customer ID", duplicate_customers, "canonical_customer_id"))

    duplicate_meters = meters.filter(pl.col("canonical_meter_id").is_duplicated())
    issues.append(_issue_rows("meters", "duplicate_meter", "medium", "Duplicate canonical meter ID", duplicate_meters, "canonical_meter_id"))

    duplicate_readings = readings.filter(pl.struct(["canonical_meter_id", "canonical_reading_date"]).is_duplicated())
    issues.append(_issue_rows("meter_readings", "duplicate_reading", "medium", "Duplicate meter/date pair", duplicate_readings, "canonical_meter_id"))

    missing_readings = readings.filter(pl.col("consumption_kwh").is_null())
    issues.append(_issue_rows("meter_readings", "missing_reading", "high", "Missing consumption value", missing_readings, "canonical_meter_id"))

    suspicious_readings = readings.filter((pl.col("consumption_kwh") < 0) | (pl.col("consumption_kwh") > extreme_threshold))
    issues.append(_issue_rows("meter_readings", "suspicious_reading", "high", "Negative or extreme consumption", suspicious_readings, "canonical_meter_id"))

    cancelled_bills = billing.filter(pl.col("bill_status") == "CANCELLED")
    issues.append(_issue_rows("billing", "cancelled_bill", "low", "Cancelled bill", cancelled_bills, "bill_id"))

    missing_bills = billing.filter(pl.col("bill_amount").is_null())
    issues.append(_issue_rows("billing", "missing_bill_amount", "high", "Missing bill amount", missing_bills, "bill_id"))

    issue_frames = [frame for frame in issues if not frame.is_empty()]
    if issue_frames:
        combined = pl.concat(issue_frames, how="vertical_relaxed")
    else:
        combined = pl.DataFrame(schema={"dataset": pl.Utf8, "issue_type": pl.Utf8, "severity": pl.Utf8, "reason": pl.Utf8, "record_id": pl.Utf8})

    summary = combined.group_by("dataset").len().rename({"len": "issue_count"}) if not combined.is_empty() else pl.DataFrame({"dataset": [], "issue_count": []})
    quarantine = combined.filter(pl.col("severity").is_in(["high", "medium"]))

    return {"issues": combined, "quarantine": quarantine, "summary": summary}
