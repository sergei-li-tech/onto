import { describe, expect, it } from "vitest";
import { formatCardinality } from "./cardinality";

describe("formatCardinality", () => {
  it("writes an optional single end as 0..1", () => {
    expect(formatCardinality("0", "1")).toBe("0..1");
  });

  it("writes an open end as 0..*", () => {
    expect(formatCardinality("0", "many")).toBe("0..*");
  });

  it("writes a required many end as 1..*", () => {
    expect(formatCardinality("1", "many")).toBe("1..*");
  });

  it("collapses a fixed count to one mark", () => {
    expect(formatCardinality("1", "1")).toBe("1");
    expect(formatCardinality("many", "many")).toBe("*");
    expect(formatCardinality("0", "0")).toBe("0");
  });
});
