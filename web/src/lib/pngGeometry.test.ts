import { describe, expect, it } from "vitest";
import {
  boxBetween,
  captureGeometry,
  PNG_PADDING,
  PNG_SCALE,
  pngFileName,
  unionBoxes,
} from "./pngGeometry";

describe("pngGeometry", () => {
  it("unions node boxes into the full graph bounds", () => {
    const bounds = unionBoxes([
      { x: 100, y: 40, width: 200, height: 80 },
      { x: -50, y: 200, width: 120, height: 60 },
    ]);
    expect(bounds).toEqual({ x: -50, y: 40, width: 350, height: 220 });
  });

  it("returns null for an empty graph", () => {
    expect(unionBoxes([])).toBeNull();
  });

  it("normalises a box from two corner points", () => {
    expect(boxBetween({ x: 30, y: 90 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 20,
      height: 70,
    });
  });

  it("covers the whole graph with padding and doubles the pixel size", () => {
    const geometry = captureGeometry({ x: 100, y: 50, width: 400, height: 300 });
    expect(geometry.cssWidth).toBe(400 + PNG_PADDING * 2);
    expect(geometry.cssHeight).toBe(300 + PNG_PADDING * 2);
    expect(geometry.width).toBe((400 + PNG_PADDING * 2) * PNG_SCALE);
    expect(geometry.height).toBe((300 + PNG_PADDING * 2) * PNG_SCALE);
    // The graph origin is shifted so nothing is cropped on the left/top edge.
    expect(geometry.transform).toBe(
      `translate(${(PNG_PADDING - 100) * PNG_SCALE}px, ${(PNG_PADDING - 50) * PNG_SCALE}px) scale(${PNG_SCALE})`,
    );
    expect(geometry.width / geometry.cssWidth).toBe(PNG_SCALE);
  });

  it("uses the same file naming scheme as the other exports", () => {
    expect(pngFileName("salon-gangnam")).toBe("salon-gangnam-graph.png");
    expect(pngFileName("  ")).toBe("ontology-graph.png");
    expect(pngFileName(undefined)).toBe("ontology-graph.png");
  });
});
