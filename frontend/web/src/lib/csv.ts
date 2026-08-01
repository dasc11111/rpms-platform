export type CsvColumn = { key: string; label: string };

function escapeCsvValue(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes(String.fromCharCode(34)) || s.includes("\n")) {
    return String.fromCharCode(34) + s.replace(/"/g, String.fromCharCode(34) + String.fromCharCode(34)) + String.fromCharCode(34);
  }
return s;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: CsvColumn[]) {
  const lines: string[] = [columns.map((c) => escapeCsvValue(c.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvValue(row[c.key])).join(","));
  }
  const csv = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
