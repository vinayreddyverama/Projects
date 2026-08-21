# Project Instructions

This repository implements an open-source, on-premises utility customer and consumption analytics platform.

## Architecture

Use a Bronze / Silver / Gold design.

- Bronze preserves source data and ingestion metadata.
- Silver standardizes identifiers, dates, locations, and units.
- Gold exposes business-ready analytics tables.

## Technology

Primary local stack:

- Python
- Polars
- DuckDB
- Parquet
- Streamlit
- Pytest
- Faker
- scikit-learn
- Tesseract OCR
- Docker Compose

## Coding standards

- Use type hints.
- Prefer small, testable functions.
- Avoid hardcoded business rules.
- Preserve lineage and source fields.
- Do not silently drop suspicious records.
- Add tests for business logic.

## Security

Never commit secrets, `.env` files, production data, or real customer data.
