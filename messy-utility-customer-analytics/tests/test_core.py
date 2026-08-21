import polars as pl

from utility_analytics.normalization import normalize_billing, normalize_customers, normalize_meters, normalize_readings
from utility_analytics.quality import assess_quality


def test_normalization_builds_canonical_ids() -> None:
    customers = pl.DataFrame(
        {
            "customer_id": ["cus-00123"],
            "customer_name": ["A B"],
            "phone": ["(555) 123-4567"],
            "address": ["Street 1"],
            "location": ["north"],
            "customer_category": ["RESIDENTIAL"],
            "region": ["NORTH"],
            "created_at": ["2025-01-01"],
            "status": ["ACTIVE"],
            "source_system": ["crm"],
            "source_customer_id": ["cus-00123"],
        }
    )
    normalized = normalize_customers(customers)
    assert normalized["canonical_customer_id"][0] == "CUS00123"
    assert normalized["normalized_location"][0] == "NORTH"


def test_quality_flags_missing_and_suspicious_readings() -> None:
    customers = normalize_customers(
        pl.DataFrame(
            {
                "customer_id": ["CUS00123"],
                "customer_name": ["A B"],
                "phone": ["1"],
                "address": ["Street 1"],
                "location": ["north"],
                "customer_category": ["RESIDENTIAL"],
                "region": ["NORTH"],
                "created_at": ["2025-01-01"],
                "status": ["ACTIVE"],
                "source_system": ["crm"],
                "source_customer_id": ["CUS00123"],
            }
        )
    )
    meters = normalize_meters(
        pl.DataFrame(
            {
                "meter_id": ["MTR00001"],
                "customer_id": ["CUS00123"],
                "install_date": ["2025-01-01"],
                "meter_type": ["SMART"],
                "meter_status": ["ACTIVE"],
                "region": ["NORTH"],
                "reassigned_to_customer_id": [None],
                "reassignment_effective_from": [None],
            }
        )
    )
    readings = normalize_readings(
        pl.DataFrame(
            {
                "meter_id": ["MTR00001", "MTR00001"],
                "customer_id": ["CUS00123", "CUS00123"],
                "reading_timestamp": ["2025-01-01", "2025-02-01"],
                "consumption_kwh": [None, -5.0],
                "reading_unit": ["kwh", "kwh"],
                "source_system": ["mdm", "mdm"],
                "reading_status": ["RAW", "RAW"],
            }
        )
    )
    billing = normalize_billing(
        pl.DataFrame(
            {
                "bill_id": ["B1"],
                "customer_id": ["CUS00123"],
                "meter_id": ["MTR00001"],
                "billing_period": ["2025-01"],
                "bill_date": ["2025-01-15"],
                "consumption_kwh": [10.0],
                "bill_amount": [None],
                "discount": [0.0],
                "tax_rate": [0.1],
                "bill_status": ["PAID"],
                "source_system": ["billing"],
            }
        )
    )

    result = assess_quality({"customers": customers, "meters": meters, "meter_readings": readings, "billing": billing})
    assert result["issues"].height >= 2