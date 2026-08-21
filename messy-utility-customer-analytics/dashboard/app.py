"""Streamlit dashboard entry point."""

from __future__ import annotations

import sys
from pathlib import Path

import polars as pl
import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from utility_analytics.common import GOLD_DIR
from utility_analytics.pipeline import run_pipeline


def _load_csv(name: str) -> pl.DataFrame:
    path = GOLD_DIR / f"{name}.csv"
    if not path.exists():
        return pl.DataFrame()
    return pl.read_csv(path)


def _ensure_gold_outputs() -> None:
    required = GOLD_DIR / "answer_2_regions.csv"
    if not required.exists():
        run_pipeline(seed=42)


def _scalar(name: str, column: str, default: int = 0) -> int:
    frame = _load_csv(name)
    if frame.is_empty() or column not in frame.columns:
        return default
    return int(frame[0, column])


def main() -> None:
    st.set_page_config(page_title="Utility Analytics", layout="wide")
    st.title("Messy Utility Customer & Consumption Analytics")
    st.caption("Local-first utility analytics for the six target business questions.")

    _ensure_gold_outputs()

    if st.button("Run pipeline"):
        summary = run_pipeline()
        st.success(
            f"Pipeline complete | quality issues: {summary['quality_issues']} | unreconciled bills: {summary['unreconciled_bills']}"
        )

    metrics = st.columns(4)
    with metrics[0]:
        st.metric("Unreconciled Bills", _scalar("answer_5_unreconciled_bills", "unreconciled_bills"))
    with metrics[1]:
        st.metric("Anomalous Customers", _load_csv("answer_1_abnormal_customers").height)
    with metrics[2]:
        st.metric("Reading-Issue Customers", _scalar("answer_4_reading_issues", "missing_or_suspicious_readings"))
    with metrics[3]:
        region_frame = _load_csv("answer_2_regions")
        top_region = region_frame[0, 0] if not region_frame.is_empty() else "N/A"
        st.metric("Top Region", str(top_region))

    st.subheader("Customers with abnormal consumption")
    st.dataframe(_load_csv("answer_1_abnormal_customers"), width="stretch")

    st.subheader("Regions with the highest electricity consumption")
    st.dataframe(_load_csv("answer_2_regions"), width="stretch")

    st.subheader("Customer categories with the largest consumption growth")
    st.dataframe(_load_csv("answer_3_category_growth"), width="stretch")

    st.subheader("Customers with missing or suspicious readings")
    st.dataframe(_load_csv("answer_4_reading_issues"), width="stretch")

    st.subheader("Bills that cannot be reconciled with meter consumption")
    st.dataframe(_load_csv("answer_5_unreconciled_bills"), width="stretch")

    st.subheader("Top 20 potentially anomalous customers")
    st.dataframe(_load_csv("answer_6_top_20_anomalous_customers"), width="stretch")


if __name__ == "__main__":
    main()
