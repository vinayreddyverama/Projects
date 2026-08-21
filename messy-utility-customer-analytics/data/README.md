# Data Folder

This folder stores tiny, reproducible sample data for the project.
Keep the committed sample set small enough to run locally, and do not commit real customer data, large generated datasets, or source scans.

## Source formats

The synthetic dataset should mimic these inputs:

- `customers.csv`
- `meters.csv`
- `meter_readings.csv`
- `billing.csv`
- `service_requests.json`
- `tariffs.xlsx`
- scanned bill images

## Known data issues

The dataset is intentionally messy and includes:

- inconsistent customer IDs
- duplicate customers
- missing meter readings
- readings arriving out of order
- impossible consumption values
- different date formats
- inconsistent spelling of locations
- meters reassigned to customers
- cancelled bills
- partial or missing billing records
- nested JSON structures
- Excel reference data
- occasional duplicate transactions

## Baseline profile

| Dataset | Rows | Columns | Nulls | Duplicates |
| --- | ---: | ---: | ---: | ---: |
| customers | 48,231 | 12 | 423 | 18 |
| meters | 51,892 | 8 | 127 | 34 |
| meter_readings | 1,245,321 | 7 | 8,921 | 1,203 |
| billing | 98,341 | 11 | 731 | 92 |
| service_requests | 21,394 | 9 | 312 | 14 |

These counts are the starting point for source profiling, data-quality scoring, and quarantine logic.
