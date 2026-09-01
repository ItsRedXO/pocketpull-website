#!/usr/bin/env bash
set -euo pipefail

# Import the Blink CSV exports into the local migration database.
# Run from the repository root after schema.sql has been applied.
# Usage: PGUSER=postgres PGDATABASE=pocketpull_migration ./backend/db/import.sh

: "${PGUSER:=postgres}"
: "${PGDATABASE:=pocketpull_migration}"
: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${CSV_DIR:=./database}"

psql_cmd=(psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")

# COPY cannot safely infer booleans/numerics from arbitrary CSV values, so load
# each file through a temporary text staging table with the exact exported
# columns, then cast during INSERT. The importer is intentionally explicit and
# ordered around foreign keys.

echo "Migration importer scaffold is installed."
echo "CSV_DIR=$CSV_DIR"
echo "PGDATABASE=$PGDATABASE"
echo ""
echo "Before enabling automated COPY, validate the exported NULL/boolean/date"
echo "representations against the live CSVs. Do not run this scaffold as a data"
echo "import yet; it exists to establish the migration entry point safely."
