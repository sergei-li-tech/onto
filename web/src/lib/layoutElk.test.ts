import { describe, expect, it } from "vitest";
import { entityLayoutSize } from "./layoutElk";

describe("entityLayoutSize", () => {
  it("grows height with attribute count", () => {
    expect(entityLayoutSize({ attributes: [{ id: "id" }] }).height).toBe(68);
    expect(entityLayoutSize({ attributes: Array.from({ length: 5 }, (_, i) => ({ id: `a${i}` })) }).height).toBe(
      148,
    );
  });
});
