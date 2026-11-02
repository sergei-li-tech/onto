import { describe, expect, it } from "vitest";
import { nodePositionForFlowCenter, viewportCenterScreenPoint } from "./graphPlacement";

describe("graphPlacement", () => {
  it("maps viewport center to screen coordinates", () => {
    const rect = { left: 100, top: 50, width: 400, height: 300 };
    expect(viewportCenterScreenPoint(rect)).toEqual({ x: 300, y: 200 });
  });

  it("offsets flow center to node top-left", () => {
    expect(nodePositionForFlowCenter({ x: 300, y: 200 })).toEqual({ x: 220, y: 172 });
  });
});
