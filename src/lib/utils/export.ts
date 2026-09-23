// Convert array of objects to CSV and download
export function downloadCSV(
  filename: string,
  rows: Record<string, unknown>[]
) {
  if (!rows.length) {
    throw new Error('No data to export');
  }

  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [];
  lines.push(headers.join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }

  const csv = '\uFEFF' + lines.join('\n'); // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Format date for export
export function formatDateForExport(date: string | null | undefined): string {
  if (!date) return '';
  return date.slice(0, 10);
}