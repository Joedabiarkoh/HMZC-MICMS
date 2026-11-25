import { describe, expect, it } from "vitest";
import { computeTax } from "./angolaTax";

describe("computeTax", () => {
  it("adds 14% IVA and deducts 6.5% withholding from the pre-IVA base", () => {
    expect(computeTax(1000, 14, 6.5)).toEqual({ base: 1000, iva: 140, gross: 1140, withheld: 65, netPayable: 1075 });
  });
  it("0% IVA and no withholding leaves the total alone", () => {
    expect(computeTax(180, 0, 0)).toEqual({ base: 180, iva: 0, gross: 180, withheld: 0, netPayable: 180 });
  });
});
