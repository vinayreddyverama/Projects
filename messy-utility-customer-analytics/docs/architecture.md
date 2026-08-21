# Architecture

The project uses a local-first Bronze / Silver / Gold design.

## Bronze
- Preserve raw source files.
- Capture ingestion metadata.
- Avoid business transformations.

## Silver
- Standardize IDs, dates, regions, and units.
- Resolve customers and meters.
- Apply quality rules.
- Quarantine invalid records.

## Gold
- Produce business-ready analytics tables.
- Support the six final business questions.
- Feed the dashboard and SQL analysis.
