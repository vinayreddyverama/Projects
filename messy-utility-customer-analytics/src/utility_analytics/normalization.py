"""Identifier, date, region, and address normalization."""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import datetime

import polars as pl


LOCATION_MAP = {
    "NRT": "NORTH",
    "NORTH": "NORTH",
    "SOUTH": "SOUTH",
    "STH": "SOUTH",
    "EAST": "EAST",
    "EST": "EAST",
    "WEST": "WEST",
    "WST": "WEST",
}


def normalize_customer_id(value: object, prefix: str = "CUS") -> str | None:
    """Canonicalize a messy customer identifier."""

    if value is None:
        return None
    digits = "".join(character for character in str(value) if character.isdigit())
    if not digits:
        return None
    return f"{prefix}{int(digits):05d}"


def normalize_meter_id(value: object, prefix: str = "MTR") -> str | None:
    """Canonicalize a messy meter identifier."""

    if value is None:
        return None
    digits = "".join(character for character in str(value) if character.isdigit())
    if not digits:
        return None
    return f"{prefix}{int(digits):05d}"


def normalize_phone(value: object) -> str | None:
    """Keep only digits in phone numbers."""

    if value is None:
        return None
    digits = "".join(character for character in str(value) if character.isdigit())
    return digits or None


def normalize_location(value: object) -> str | None:
    """Standardize inconsistent location spellings."""

    if value is None:
        return None
    cleaned = re.sub(r"[^A-Za-z]", "", str(value)).upper()
    if not cleaned:
        return None
    return LOCATION_MAP.get(cleaned, cleaned)


def normalize_timestamp(value: object) -> str | None:
    """Convert a common date string into ISO date format."""

    if value is None:
        return None
    text = str(value)
    for pattern in ["%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S"]:
        try:
            return datetime.strptime(text[:19], pattern).date().isoformat()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text).date().isoformat()
    except ValueError:
        return None


def normalize_customers(frame: pl.DataFrame) -> pl.DataFrame:
    """Normalize customer source data."""

    return frame.with_columns(
        pl.col("customer_id").map_elements(normalize_customer_id, return_dtype=pl.Utf8).alias("canonical_customer_id"),
        pl.col("customer_name").str.to_uppercase().alias("normalized_customer_name"),
        pl.col("phone").map_elements(normalize_phone, return_dtype=pl.Utf8).alias("normalized_phone"),
        pl.col("address").fill_null("UNKNOWN").str.replace_all(r"\s+", " ").str.to_uppercase().alias("normalized_address"),
        pl.col("location").map_elements(normalize_location, return_dtype=pl.Utf8).alias("normalized_location"),
        pl.col("created_at").map_elements(normalize_timestamp, return_dtype=pl.Utf8).alias("canonical_created_at"),
    )


def normalize_meters(frame: pl.DataFrame) -> pl.DataFrame:
    """Normalize meter source data."""

    return frame.with_columns(
        pl.col("meter_id").map_elements(normalize_meter_id, return_dtype=pl.Utf8).alias("canonical_meter_id"),
        pl.col("customer_id").map_elements(normalize_customer_id, return_dtype=pl.Utf8).alias("canonical_customer_id"),
        pl.col("reassigned_to_customer_id").map_elements(normalize_customer_id, return_dtype=pl.Utf8).alias("reassigned_to_canonical_customer_id"),
        pl.col("install_date").map_elements(normalize_timestamp, return_dtype=pl.Utf8).alias("canonical_install_date"),
        pl.col("reassignment_effective_from").map_elements(normalize_timestamp, return_dtype=pl.Utf8).alias("canonical_reassignment_effective_from"),
        pl.col("region").map_elements(normalize_location, return_dtype=pl.Utf8).alias("normalized_region"),
    )


def normalize_readings(frame: pl.DataFrame) -> pl.DataFrame:
    """Normalize meter readings."""

    return frame.with_columns(
        pl.col("meter_id").map_elements(normalize_meter_id, return_dtype=pl.Utf8).alias("canonical_meter_id"),
        pl.col("customer_id").map_elements(normalize_customer_id, return_dtype=pl.Utf8).alias("canonical_customer_id"),
        pl.col("reading_timestamp").map_elements(normalize_timestamp, return_dtype=pl.Utf8).alias("canonical_reading_date"),
        pl.col("reading_unit").str.to_uppercase().alias("reading_unit"),
    ).sort(["canonical_meter_id", "canonical_reading_date"])


def normalize_billing(frame: pl.DataFrame) -> pl.DataFrame:
    """Normalize billing source data."""

    return frame.with_columns(
        pl.col("bill_id").cast(pl.Utf8),
        pl.col("customer_id").map_elements(normalize_customer_id, return_dtype=pl.Utf8).alias("canonical_customer_id"),
        pl.col("meter_id").map_elements(normalize_meter_id, return_dtype=pl.Utf8).alias("canonical_meter_id"),
        pl.col("bill_date").map_elements(normalize_timestamp, return_dtype=pl.Utf8).alias("canonical_bill_date"),
        pl.col("billing_period").cast(pl.Utf8).str.slice(0, 7).alias("canonical_billing_period"),
        pl.col("bill_status").str.to_uppercase().alias("bill_status"),
    )


def normalize_service_requests(requests: Iterable[dict[str, object]] | pl.DataFrame) -> pl.DataFrame:
    """Flatten nested service requests into a tabular form."""

    if isinstance(requests, pl.DataFrame):
        return requests

    rows: list[dict[str, object]] = []
    for request in requests:
        customer = request.get("customer", {}) if isinstance(request.get("customer"), dict) else {}
        details = request.get("details", {}) if isinstance(request.get("details"), dict) else {}
        rows.append(
            {
                "request_id": request.get("request_id"),
                "customer_id": normalize_customer_id(customer.get("customer_id")),
                "request_type": request.get("request_type"),
                "status": str(request.get("status", "")).upper(),
                "priority": str(details.get("priority", "")).upper(),
                "channel": str(details.get("channel", "")).lower(),
                "created_at": normalize_timestamp(request.get("created_at")),
            }
        )
    return pl.DataFrame(rows)


def normalize_sources(sources: dict[str, pl.DataFrame]) -> dict[str, pl.DataFrame]:
    """Normalize the core source frames together."""

    return {
        "customers": normalize_customers(sources["customers"]),
        "meters": normalize_meters(sources["meters"]),
        "meter_readings": normalize_readings(sources["meter_readings"]),
        "billing": normalize_billing(sources["billing"]),
        "service_requests": normalize_service_requests(sources["service_requests"]),
    }
