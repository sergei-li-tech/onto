import { describe, expect, it } from "vitest";
import {
  formatCardinality,
  formatCardinalitySpec,
  isCardinalityBoundValid,
  isCardinalityRangeValid,
  normalizeBound,
  numericBound,
  parseCardinalityRange,
  parseCardinalitySpec,
} from "./cardinality";

describe("formatCardinality", () => {
  it("writes an optional single end as 0..1", () => {
    expect(formatCardinality("0", "1")).toBe("0..1");
  });

  it("writes an open end as 0..*", () => {
    expect(formatCardinality("0", "*")).toBe("0..*");
  });

  it("writes a required many end as 1..*", () => {
    expect(formatCardinality("1", "*")).toBe("1..*");
  });

  it("collapses a fixed count to one mark", () => {
    expect(formatCardinality("1", "1")).toBe("1");
    expect(formatCardinality("*", "*")).toBe("*");
    expect(formatCardinality("0", "0")).toBe("0");
    expect(formatCardinality("5", "5")).toBe("5");
  });

  it("handles custom ranges like 2..5", () => {
    expect(formatCardinality("2", "5")).toBe("2..5");
  });
});

describe("cardinality range helpers", () => {
  it("normalizes bounds correctly", () => {
    expect(normalizeBound("*")).toBe("*");
    expect(normalizeBound(" 1 ")).toBe("1");
    expect(numericBound("*")).toBe(Infinity);
    expect(numericBound("3")).toBe(3);
  });

  it("validates bound strings", () => {
    expect(isCardinalityBoundValid("0")).toBe(true);
    expect(isCardinalityBoundValid("10")).toBe(true);
    expect(isCardinalityBoundValid("*")).toBe(true);
    expect(isCardinalityBoundValid("-1")).toBe(false);
    expect(isCardinalityBoundValid("abc")).toBe(false);
  });

  it("validates ranges", () => {
    expect(isCardinalityRangeValid("0", "1")).toBe(true);
    expect(isCardinalityRangeValid("1", "*")).toBe(true);
    expect(isCardinalityRangeValid("2", "5")).toBe(true);
    expect(isCardinalityRangeValid("5", "2")).toBe(false);
    expect(isCardinalityRangeValid("1", "0")).toBe(false);
    expect(isCardinalityRangeValid("*", "1")).toBe(false);
  });

  it("parses cardinality range strings", () => {
    expect(parseCardinalityRange("0..1")).toEqual({ min: "0", max: "1" });
    expect(parseCardinalityRange("1..*")).toEqual({ min: "1", max: "*" });
    expect(parseCardinalityRange("1")).toEqual({ min: "1", max: "1" });
    expect(parseCardinalityRange("*")).toEqual({ min: "*", max: "*" });
    expect(parseCardinalityRange("invalid")).toBeNull();
  });

  it("parses compact cardinality specifications", () => {
    // Single range (shorthand for from: 1..1, to: range)
    expect(parseCardinalitySpec("0..*")).toEqual({
      from_min: "1",
      from_max: "1",
      to_min: "0",
      to_max: "*",
    });
    expect(parseCardinalitySpec("1..*")).toEqual({
      from_min: "1",
      from_max: "1",
      to_min: "1",
      to_max: "*",
    });
    expect(parseCardinalitySpec("0..1")).toEqual({
      from_min: "1",
      from_max: "1",
      to_min: "0",
      to_max: "1",
    });

    // Arrow syntax: from -> to
    expect(parseCardinalitySpec("0..1 -> 0..*")).toEqual({
      from_min: "0",
      from_max: "1",
      to_min: "0",
      to_max: "*",
    });

    // Object syntax: { from, to }
    expect(parseCardinalitySpec({ from: "0..1", to: "1..*" })).toEqual({
      from_min: "0",
      from_max: "1",
      to_min: "1",
      to_max: "*",
    });
    expect(parseCardinalitySpec({ to: "0..*" })).toEqual({
      from_min: "1",
      from_max: "1",
      to_min: "0",
      to_max: "*",
    });
  });

  it("formats bounds into compact cardinality spec", () => {
    // Standard from 1..1 collapses to single target string
    expect(formatCardinalitySpec("1", "1", "0", "*")).toBe("0..*");
    expect(formatCardinalitySpec("1", "1", "1", "*")).toBe("1..*");
    expect(formatCardinalitySpec("1", "1", "0", "1")).toBe("0..1");
    expect(formatCardinalitySpec("1", "1", "1", "1")).toBe("1");

    // Non-standard from emits object
    expect(formatCardinalitySpec("0", "1", "0", "*")).toEqual({
      from: "0..1",
      to: "0..*",
    });
    expect(formatCardinalitySpec("0", "*", "0", "*")).toEqual({
      from: "0..*",
      to: "0..*",
    });
  });
});
