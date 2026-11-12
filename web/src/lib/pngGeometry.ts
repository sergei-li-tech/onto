export type Box = { x: number; y: number; width: number; height: number };

/** Padding around the graph, in layout px, so edge labels and cardinality marks are not clipped. */
export const PNG_PADDING = 56;

/** Output is rendered at twice the layout size for legibility. */
export const PNG_SCALE = 2;

/** Background of the graph pane, so the PNG is opaque like the app. */
export const PNG_BACKGROUND = "#f8fafc";

export function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boxBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export type CaptureGeometry = {
  /** CSS size given to the captured element. */
  cssWidth: number;
  cssHeight: number;
  /** Raster size of the PNG in pixels (2× the CSS size). */
  width: number;
  height: number;
  /** Transform that positions the whole graph inside the captured area. */
  transform: string;
};

/**
 * Turns the graph bounds into the size/transform used for the PNG capture:
 * the whole graph plus padding is rendered at `scale`, nothing is cropped.
 */
export function captureGeometry(
  bounds: Box,
  padding = PNG_PADDING,
  scale = PNG_SCALE,
): CaptureGeometry {
  const cssWidth = Math.max(1, Math.ceil(bounds.width + padding * 2));
  const cssHeight = Math.max(1, Math.ceil(bounds.height + padding * 2));
  const translateX = (padding - bounds.x) * scale;
  const translateY = (padding - bounds.y) * scale;
  return {
    cssWidth,
    cssHeight,
    width: Math.round(cssWidth * scale),
    height: Math.round(cssHeight * scale),
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
  };
}

/** Same naming scheme as the other exports: `<domain>-<kind>.png`. */
export function pngFileName(domain?: string): string {
  const base = (domain ?? "").trim();
  return `${base || "ontology"}-graph.png`;
}
