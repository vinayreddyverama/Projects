from utility_analytics.normalization import normalize_customer_id, normalize_location
from utility_analytics.pipeline import run_pipeline


def test_pipeline_smoke() -> None:
    result = run_pipeline()
    assert result["quality_issues"] >= 0
    assert result["anomalous_customers"] >= 0


def test_customer_id_normalization() -> None:
    assert normalize_customer_id("cus00123") == "CUS00123"
    assert normalize_customer_id("CUSTOMER_00123") == "CUS00123"


def test_location_normalization() -> None:
    assert normalize_location("Hyd") == "HYD"
    assert normalize_location("Hyderabad City") == "HYDERABADCITY"
