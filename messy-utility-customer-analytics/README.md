# Messy Utility Customer & Consumption Analytics

Open-source, on-premises analytics platform for messy utility data. The project is designed to answer these final business questions:

1. Identify customers whose consumption appears abnormal.
2. Which regions have the highest electricity consumption?
3. Which customer categories have experienced the largest consumption growth?
4. How many customers have missing or suspicious meter readings?
5. How many bills cannot be reconciled with meter consumption?
6. Identify the top 20 potentially anomalous customers.

## Recommended build order

This repository is structured as a complete, locally runnable deliverable project using a free, open-source stack:

- Python 3.12
- Polars
- DuckDB
- Parquet
- Pytest
- Streamlit
- Faker
- scikit-learn
- Tesseract OCR
- Docker Compose

Heavier platform components such as Airflow, NiFi, MinIO, Iceberg, and Spark are reserved for scale-out later and are not required for the first outcome.

## Delivery strategy

1. Synthetic data generator with reproducible bad data.
2. Bronze raw landing area.
3. Silver canonical tables.
4. Data quality and quarantine.
5. Billing reconciliation.
6. Anomaly detection.
7. DuckDB analytics layer.
8. Streamlit dashboard.
9. Tests and CI.

## Workflow diagram

See [docs/workflow.md](docs/workflow.md) for the Mermaid workflow diagram, local run commands, and the mapping from pipeline stages to the six business answers.

## Repository shape

- `config/` for rules and reference data
- `data/sample/` for tiny committed examples
- `docs/` for architecture and design decisions
- `dashboard/` for Streamlit
- `scripts/` for runnable utilities
- `src/utility_analytics/` for core logic
- `tests/` for validation

## Local execution intent

The first complete version should run locally without cloud services and should be able to produce the final analytics outputs from generated sample data.
