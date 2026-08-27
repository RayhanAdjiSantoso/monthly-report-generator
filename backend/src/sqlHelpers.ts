// Builds a parameterized multi-row INSERT statement. Values are always bound
// as query parameters — never string-interpolated — so this is safe for any
// row content, including user-controlled strings.
export function buildBulkInsert(table: string, columns: string[], rows: unknown[][]): { text: string; values: unknown[] } | null {
  if (!rows.length) return null;
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = row.map((_, i) => `$${values.length + i + 1}`);
    values.push(...row);
    return `(${placeholders.join(', ')})`;
  });
  return { text: `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`, values };
}
