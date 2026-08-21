# Project Workflow

The project can be rendered as a Mermaid flowchart in GitHub, VS Code Markdown preview, or any Mermaid-compatible Markdown viewer.

```mermaid
flowchart LR
    A[Raw utility sources<br/>CSV, JSON, Excel, bill images] --> B[Generate or ingest batch]
    B --> C[Bronze<br/>preserve source records and lineage]
    C --> D[Silver normalization<br/>canonical IDs, dates, regions, units]
    D --> E[Data quality checks]
    E --> F[Quarantine<br/>invalid and suspicious records]
    E --> G[Billing reconciliation<br/>meter usage vs tariff bill]
    D --> G
    D --> H[Anomaly detection<br/>growth, quality, mismatch patterns]
    G --> H
    E --> H
    G --> I[Gold analytics tables]
    H --> I
    I --> J[Streamlit dashboard]
    I --> K[Six business answers]

    K --> K1[1. Abnormal consumption]
    K --> K2[2. Highest-consumption regions]
    K --> K3[3. Category consumption growth]
    K --> K4[4. Missing or suspicious readings]
    K --> K5[5. Unreconciled bills]
    K --> K6[6. Top 20 anomalous customers]
```

## Run the workflow locally

From the workspace root:

```bash
source .venv/bin/activate
python messy-utility-customer-analytics/scripts/generate_synthetic_data.py
pytest messy-utility-customer-analytics/tests -q
streamlit run messy-utility-customer-analytics/dashboard/app.py
```

The pipeline writes curated Parquet files and the six answer CSVs under `data/silver/`, `data/gold/`, and `data/quarantine/`.