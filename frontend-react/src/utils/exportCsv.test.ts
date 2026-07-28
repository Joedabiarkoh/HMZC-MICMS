import { describe, expect, it } from "vitest";
import { buildCsv } from "./exportCsv";

interface Row {
  name: string;
  note: string | null;
  count: number;
}

describe("buildCsv", () => {
  it("renders a header row followed by one row per record", () => {
    const rows: Row[] = [{ name: "Alice", note: "ok", count: 3 }];
    const csv = buildCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Note", value: (r) => r.note },
      { header: "Count", value: (r) => r.count },
    ]);
    expect(csv).toBe("Name,Note,Count\r\nAlice,ok,3");
  });

  it("quotes and doubles embedded quotes, commas, and newlines (RFC 4180)", () => {
    const rows: Row[] = [{ name: 'Vessel "MV Test", Ltd', note: "line1\nline2", count: 1 }];
    const csv = buildCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Note", value: (r) => r.note },
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe('"Vessel ""MV Test"", Ltd","line1\nline2"');
  });

  it("renders null/undefined values as an empty cell, not the literal string 'null'", () => {
    const rows: Row[] = [{ name: "Bob", note: null, count: 0 }];
    const csv = buildCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Note", value: (r) => r.note },
    ]);
    expect(csv.split("\r\n")[1]).toBe("Bob,");
  });

  it("still emits a header-only CSV for an empty row set", () => {
    const csv = buildCsv([] as Row[], [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toBe("Name");
  });
});
