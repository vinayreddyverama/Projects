# Design Decisions

## Local-first runtime
Use DuckDB and Parquet first so the project runs on a laptop without cloud services.

## Configuration-driven rules
Keep data-quality and anomaly thresholds in YAML files.

## No silent deletion
Invalid records are classified and quarantined rather than dropped.
