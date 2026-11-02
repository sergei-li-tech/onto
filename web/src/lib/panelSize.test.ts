import { describe, expect, it } from "vitest";
import { nextPanelWidth } from "./panelSize";

describe("nextPanelWidth", () => {
  it("grows when the pointer moves outward", () => {
    expect(nextPanelWidth(400, 180, 1200, 360, 220)).toBe(400);
  });

  it("stops at the minimum", () => {
    expect(nextPanelWidth(40, 180, 1200, 360, 220)).toBe(180);
  });

  it("leaves the center its minimum", () => {
    expect(nextPanelWidth(900, 180, 1000, 360, 220)).toBe(420);
  });
});
