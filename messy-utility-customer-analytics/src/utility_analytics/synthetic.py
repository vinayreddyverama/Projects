"""Synthetic utility data generation."""

from __future__ import annotations

import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

import polars as pl
from faker import Faker
from openpyxl import Workbook
from PIL import Image, ImageDraw

from utility_analytics.common import RAW_DIR, ensure_directories, write_frame


REGION_MAP = {
    "NORTH": ["North", "NORTH", "Nrt"],
    "SOUTH": ["South", "SOUTH", "Sth"],
    "EAST": ["East", "EAST", "Est"],
    "WEST": ["West", "WEST", "Wst"],
}
CATEGORIES = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "GOVERNMENT"]
RAW_TARGETS = {
    "customers": {"rows": 48_231, "nulls": 423, "duplicates": 18},
    "meters": {"rows": 51_892, "nulls": 127, "duplicates": 34},
    "meter_readings": {"rows": 1_245_321, "nulls": 8_921, "duplicates": 1_203},
    "billing": {"rows": 98_341, "nulls": 731, "duplicates": 92},
    "service_requests": {"rows": 21_394, "nulls": 312, "duplicates": 14},
}


def _customer_id(index: int, messy: bool = False) -> str:
    canonical = f"CUS{index:05d}"
    if not messy:
        return canonical
    return random.choice([canonical.lower(), canonical.replace("CUS", "CUS-"), canonical.replace("CUS", "customer_")])


def _meter_id(index: int, messy: bool = False) -> str:
    canonical = f"MTR{index:05d}"
    if not messy:
        return canonical
    return random.choice([canonical.lower(), canonical.replace("MTR", "MTR-"), canonical.replace("MTR", "meter_")])


def _write_tariffs(path: Path) -> None:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "tariffs"
    worksheet.append(["tariff_id", "customer_category", "region", "effective_from", "effective_to", "energy_rate", "fixed_charge", "tax_rate"])
    tariff_index = 1
    for category in CATEGORIES:
        for region_index, region in enumerate(REGION_MAP):
            for year in [2024, 2025]:
                worksheet.append(
                    [
                        f"T{tariff_index:03d}",
                        category,
                        region,
                        f"{year}-01-01",
                        f"{year}-12-31",
                        round(4.5 + CATEGORIES.index(category) * 1.25 + region_index * 0.1, 2),
                        40 + CATEGORIES.index(category) * 15 + region_index * 5,
                        round(0.08 + region_index * 0.01, 2),
                    ]
                )
                tariff_index += 1
    workbook.save(path)


def _write_bill_image(path: Path, bill_id: str, customer_id: str, amount: float) -> None:
    image = Image.new("RGB", (900, 420), color="white")
    draw = ImageDraw.Draw(image)
    draw.text((40, 40), "UTILITY BILL", fill="black")
    draw.text((40, 110), f"Bill ID: {bill_id}", fill="black")
    draw.text((40, 160), f"Customer: {customer_id}", fill="black")
    draw.text((40, 210), f"Amount: {amount:.2f}", fill="black")
    draw.text((40, 260), f"Generated: {datetime.now().date().isoformat()}", fill="black")
    image.save(path)


def _duplicate_rows(rows: list[dict[str, object]], count: int, randomizer: random.Random) -> list[dict[str, object]]:
    """Append exact duplicate records without changing source schemas."""

    eligible = [index for index, row in enumerate(rows) if all(value is not None for value in row.values())]
    return rows + [rows[index].copy() for index in randomizer.sample(eligible, count)]


def _set_null_count(
    frame: pl.DataFrame,
    columns: list[str],
    target: int,
    randomizer: random.Random,
) -> pl.DataFrame:
    """Set an exact number of null cells across the selected columns."""

    current = sum(frame.select(pl.col(column).null_count().sum()).item() for column in columns)
    difference = target - current
    if difference < 0:
        raise ValueError(f"Generated null count {current} exceeds target {target}")
    if difference == 0:
        return frame

    candidates = [
        (row_index, column)
        for row_index in range(frame.height)
        for column in columns
        if frame[column][row_index] is not None
    ]
    if difference > len(candidates):
        raise ValueError(f"Cannot set {target} nulls across {columns}")
    selected = randomizer.sample(candidates, difference)
    updates: dict[str, list[int]] = {column: [] for column in columns}
    for row_index, column in selected:
        updates[column].append(row_index)
    for column, row_indices in updates.items():
        if row_indices:
            frame = frame.with_columns(
                pl.when(pl.int_range(0, frame.height).is_in(row_indices))
                .then(None)
                .otherwise(pl.col(column))
                .alias(column)
            )
    return frame


def generate_synthetic_data(
    output_dir: Path | None = None,
    seed: int = 42,
    customer_count: int = 48_213,
    meter_count: int = 51_858,
    months: int = 24,
) -> dict[str, Path]:
    """Generate reproducible messy utility source data."""

    ensure_directories()
    randomizer = random.Random(seed)
    random.seed(seed)
    fake = Faker()
    fake.seed_instance(seed)

    raw_dir = Path(output_dir) if output_dir is not None else RAW_DIR
    raw_dir.mkdir(parents=True, exist_ok=True)

    customer_rows: list[dict[str, object]] = []
    for index in range(1, customer_count + 1):
        region = random.choice(list(REGION_MAP))
        customer_rows.append(
            {
                "customer_id": _customer_id(index, messy=index % 3 == 0),
                "customer_name": fake.name(),
                "phone": fake.phone_number(),
                "address": fake.address().replace("\n", ", "),
                "location": random.choice(REGION_MAP[region]),
                "customer_category": random.choice(CATEGORIES),
                "region": region,
                "created_at": fake.date_between(start_date="-3y", end_date="today").isoformat(),
                "status": random.choice(["ACTIVE", "ACTIVE", "INACTIVE"]),
                "source_system": random.choice(["crm", "billing", "portal"]),
                "source_customer_id": _customer_id(index, messy=True),
            }
        )

    customers = _set_null_count(
        pl.DataFrame(customer_rows),
        ["phone", "address"],
        RAW_TARGETS["customers"]["nulls"],
        randomizer,
    )
    customers = customers.with_row_index("source_row_number")
    customers = pl.DataFrame(
        _duplicate_rows(customers.to_dicts(), RAW_TARGETS["customers"]["duplicates"], randomizer)
    )

    customer_ids = [f"CUS{i:05d}" for i in range(1, customer_count + 1)]
    meter_rows: list[dict[str, object]] = []
    for index in range(1, meter_count + 1):
        assigned_customer = random.choice(customer_ids)
        reassigned_customer = random.choice(customer_ids) if index % 11 == 0 else None
        meter_rows.append(
            {
                "meter_id": _meter_id(index, messy=index % 4 == 0),
                "customer_id": assigned_customer if index % 5 else _customer_id(index, messy=True),
                "install_date": fake.date_between(start_date="-4y", end_date="-1y").isoformat(),
                "meter_type": random.choice(["SMART", "PREPAID", "ANALOG"]),
                "meter_status": random.choice(["ACTIVE", "ACTIVE", "MAINTENANCE"]),
                "region": random.choice(list(REGION_MAP)),
                "reassigned_to_customer_id": reassigned_customer,
                "reassignment_effective_from": fake.date_between(start_date="-1y", end_date="today").isoformat() if reassigned_customer else None,
            }
        )

    meters = pl.DataFrame(meter_rows).with_columns(
        pl.col("reassigned_to_customer_id").fill_null("NO_REASSIGNMENT"),
        pl.col("reassignment_effective_from").fill_null("1900-01-01"),
    )
    meters = _set_null_count(
        meters,
        ["reassigned_to_customer_id", "reassignment_effective_from"],
        RAW_TARGETS["meters"]["nulls"],
        randomizer,
    )
    meter_rows = _duplicate_rows(meters.to_dicts(), RAW_TARGETS["meters"]["duplicates"], randomizer)
    meters = pl.DataFrame(meter_rows)

    start_month = date.today().replace(day=1) - timedelta(days=months * 32)
    reading_rows: list[dict[str, object]] = []
    for meter_index, meter in enumerate(meter_rows[:meter_count]):
        for offset in range(months):
            if len(reading_rows) >= RAW_TARGETS["meter_readings"]["rows"] - RAW_TARGETS["meter_readings"]["duplicates"]:
                break
            month = (start_month + timedelta(days=offset * 32)).replace(day=1)
            consumption = round(randomizer.uniform(120, 900), 2)
            if offset % 10 == 0:
                consumption = -abs(consumption)
            elif offset % 8 == 0:
                consumption *= 4
            if offset == months - 1 and meter_index % 29 == 0:
                consumption *= 18
            reading_rows.append(
                {
                    "meter_id": meter["meter_id"],
                    "customer_id": meter["customer_id"],
                    "reading_timestamp": month.isoformat(),
                    "consumption_kwh": consumption,
                    "reading_unit": "kwh" if offset % 7 else "KWH",
                    "source_system": "mdm",
                    "reading_status": "RAW",
                }
            )

    meter_readings = _set_null_count(
        pl.DataFrame(reading_rows),
        ["consumption_kwh"],
        RAW_TARGETS["meter_readings"]["nulls"],
        randomizer,
    )
    reading_rows = _duplicate_rows(
        meter_readings.to_dicts(), RAW_TARGETS["meter_readings"]["duplicates"], randomizer
    )
    randomizer.shuffle(reading_rows)
    meter_readings = pl.DataFrame(reading_rows)

    billing_rows: list[dict[str, object]] = []
    customer_lookup = customers.select(["customer_id", "customer_category", "region"]).to_dicts()
    customer_meta = {row["customer_id"]: row for row in customer_lookup}
    consumption_by_customer_period: dict[tuple[str, str], float] = {}
    for row in reading_rows:
        if row["consumption_kwh"] is not None:
            period = str(row["reading_timestamp"])[:7]
            key = (str(row["customer_id"]), period)
            consumption_by_customer_period[key] = consumption_by_customer_period.get(key, 0.0) + float(row["consumption_kwh"])
    billing_unique_count = RAW_TARGETS["billing"]["rows"] - RAW_TARGETS["billing"]["duplicates"]
    for index in range(billing_unique_count):
        month_offset = index % months
        month = (start_month + timedelta(days=month_offset * 32)).replace(day=1)
        billing_period = month.strftime("%Y-%m")
        customer_id = customer_ids[index % len(customer_ids)]
        profile = customer_meta.get(customer_id)
        if profile is None:
            profile = {"customer_category": CATEGORIES[index % len(CATEGORIES)]}

        month_consumption = consumption_by_customer_period.get((customer_id, billing_period), 0.0)
        category_index = CATEGORIES.index(profile["customer_category"])
        rate = 4.5 + category_index * 1.25
        fixed = 40 + category_index * 15
        tax_rate = 0.08
        expected = round((month_consumption * rate + fixed) * (1 + tax_rate), 2)
        actual = expected * random.uniform(0.92, 1.08)
        billing_rows.append(
            {
                "bill_id": f"BILL-{customer_id}-{billing_period}-{index:06d}",
                "customer_id": customer_id,
                "meter_id": random.choice(meter_rows)["meter_id"],
                "billing_period": billing_period,
                "bill_date": month.isoformat(),
                "consumption_kwh": round(month_consumption, 2),
                "bill_amount": round(actual, 2),
                "discount": round(random.uniform(0, 25), 2),
                "tax_rate": tax_rate,
                "bill_status": random.choice(["PAID", "PAID", "CANCELLED"]),
                "source_system": "billing",
            }
        )

    billing = _set_null_count(
        pl.DataFrame(billing_rows).with_columns(pl.col("bill_amount").fill_null(0.0)),
        ["bill_amount"],
        RAW_TARGETS["billing"]["nulls"],
        randomizer,
    )
    billing = pl.DataFrame(
        _duplicate_rows(billing.to_dicts(), RAW_TARGETS["billing"]["duplicates"], randomizer)
    )

    service_requests: list[dict[str, object]] = []
    service_unique_count = RAW_TARGETS["service_requests"]["rows"] - RAW_TARGETS["service_requests"]["duplicates"]
    for index in range(1, service_unique_count + 1):
        customer_id = random.choice(customer_ids)
        service_requests.append(
            {
                "request_id": f"SR{index:05d}",
                "customer": {"customer_id": customer_id, "name": customer_meta.get(customer_id, {}).get("customer_category", "UNKNOWN")},
                "created_at": fake.date_time_between(start_date="-1y", end_date="now").isoformat(),
                "request_type": random.choice(["bill_query", "meter_fault", "dispute", "service_request"]),
                "status": random.choice(["OPEN", "OPEN", "CLOSED", "RESOLVED"]),
                "details": {"priority": random.choice(["LOW", "MEDIUM", "HIGH"]), "channel": random.choice(["phone", "app"])},
                "source_system": random.choice(["crm", "billing", "portal"]),
                "assigned_team": random.choice(["field", "billing", "support"]),
                "resolution_code": random.choice(["OPEN", "CLOSED", "ESCALATED"]),
            }
        )

    service_null_candidates = [(index, "assigned_team") for index in range(len(service_requests))]
    for index, _ in randomizer.sample(service_null_candidates, RAW_TARGETS["service_requests"]["nulls"]):
        service_requests[index]["assigned_team"] = None
    service_requests = _duplicate_rows(service_requests, RAW_TARGETS["service_requests"]["duplicates"], randomizer)

    scanned_dir = raw_dir / "scanned_bills"
    scanned_dir.mkdir(parents=True, exist_ok=True)
    for item in billing_rows[:5]:
        _write_bill_image(scanned_dir / f"{item['bill_id']}.png", str(item["bill_id"]), str(item["customer_id"]), float(item["bill_amount"] or 0))

    paths = {
        "customers": raw_dir / "customers.csv",
        "meters": raw_dir / "meters.csv",
        "meter_readings": raw_dir / "meter_readings.csv",
        "billing": raw_dir / "billing.csv",
        "service_requests": raw_dir / "service_requests.json",
        "tariffs": raw_dir / "tariffs.xlsx",
    }

    write_frame(customers, paths["customers"])
    write_frame(meters, paths["meters"])
    write_frame(meter_readings, paths["meter_readings"])
    write_frame(billing, paths["billing"])
    _write_tariffs(paths["tariffs"])
    with paths["service_requests"].open("w", encoding="utf-8") as handle:
        json.dump(service_requests, handle, indent=2)

    paths["scanned_bills"] = scanned_dir
    return paths
