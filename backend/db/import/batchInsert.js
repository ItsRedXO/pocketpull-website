export function groupRowsByColumns(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.columns.join('\u0000');
    let group = groups.get(key);
    if (!group) {
      group = { columns: row.columns, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row.values);
  }
  return [...groups.values()];
}

export function buildBatchInsert({ table, columns, rows, conflictTarget }) {
  if (!rows.length) throw new Error('rows required');
  const values = [];
  let p = 1;
  const tuples = rows.map(row => {
    if (row.length !== columns.length) throw new Error('row/column length mismatch');
    values.push(...row);
    const placeholders = row.map(() => `$${p++}`).join(',');
    return `(${placeholders})`;
  }).join(',');
  const conflict = conflictTarget
    ? (() => {
        const pkColumns = conflictTarget.split(',').map(s => s.trim());
        const updates = columns.filter(c => !pkColumns.includes(c)).map(c => `${c}=EXCLUDED.${c}`).join(',');
        return updates ? `ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updates}` : `ON CONFLICT (${conflictTarget}) DO NOTHING`;
      })()
    : 'ON CONFLICT DO NOTHING';
  return {
    sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples} ${conflict}`,
    values,
  };
}
