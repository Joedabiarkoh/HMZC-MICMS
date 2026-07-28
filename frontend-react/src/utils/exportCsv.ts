// Requested directly for Certificate Log / Quotations / Invoices / the
// new Reports page: a plain CSV export of whatever list is currently on
// screen. Built client-side from data already loaded in memory rather
// than a new backend endpoint — no server round-trip, works offline
// (consistent with this app's offline-first design elsewhere), and CSV
// opens directly in Excel, which is what "CSV/Excel export" actually
// means for a list like this.

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Quote whenever the cell contains a comma, quote, or newline — the
  // three characters that would otherwise break column alignment when
  // opened in Excel/Sheets. Doubling an embedded quote is the standard
  // CSV escape (RFC 4180).
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const dataLines = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  // \r\n is the CSV-spec line ending — some spreadsheet software is
  // stricter about this than others.
  return [headerLine, ...dataLines].join("\r\n");
}

export function downloadCsv(filename: string, csvContent: string): void {
  // Leading BOM so Excel (Windows in particular) detects UTF-8 instead
  // of guessing the system codepage and mangling non-ASCII characters
  // (vessel names, técnico signatures, etc. can be anything).
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  downloadCsv(filename, buildCsv(rows, columns));
}
