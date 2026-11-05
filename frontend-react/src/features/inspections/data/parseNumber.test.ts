import { describe, expect, it } from "vitest";
import { parseNumber } from "./parseNumber";

describe("parseNumber", () => {
  it("reads plain, decimal-point and decimal-comma numbers", () => {
    expect(parseNumber("75")).toBe(75);
    expect(parseNumber("75.5")).toBe(75.5);
    expect(parseNumber("75,5")).toBe(75.5);
    expect(parseNumber("-2.5")).toBe(-2.5);
  });

  it("reads a comma followed by exactly three digits as a thousands separator", () => {
    expect(parseNumber("1,250")).toBe(1250);
    expect(parseNumber("12,345,678")).toBe(12345678);
    expect(parseNumber("1,250.5")).toBe(1250.5);
  });

  it("ignores spaces and trailing units", () => {
    expect(parseNumber("1 250 kg")).toBe(1250);
    expect(parseNumber("100 GPM")).toBe(100);
    expect(parseNumber("  42  ")).toBe(42);
  });

  it("returns null — never 0 — when there is no number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("kg")).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });

  it("does not treat a lone separator as a number", () => {
    expect(parseNumber(".")).toBeNull();
    expect(parseNumber(",")).toBeNull();
  });

  it("zero is a real value", () => {
    expect(parseNumber("0")).toBe(0);
  });
});
