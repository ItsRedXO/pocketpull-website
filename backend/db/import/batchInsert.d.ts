export type BatchRow = { columns: string[]; values: unknown[] };
export type BatchGroup = { columns: string[]; rows: unknown[][] };
export function groupRowsByColumns(rows: BatchRow[]): BatchGroup[];
export function buildBatchInsert(input: { table: string; columns: string[]; rows: unknown[][]; conflictTarget: string }): { sql: string; values: unknown[] };
