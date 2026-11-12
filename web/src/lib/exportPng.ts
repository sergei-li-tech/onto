import { toPng } from "html-to-image";
import type { Ontology } from "../types";
import {
  boxBetween,
  captureGeometry,
  PNG_BACKGROUND,
  pngFileName,
  unionBoxes,
  type Box,
} from "./pngGeometry";

export const GRAPH_VIEWPORT_SELECTOR = ".react-flow__viewport";
export const GRAPH_NODE_SELECTOR = ".react-flow__node";

/** UI chrome that must not appear in the exported picture. */
function isExportChrome(element: HTMLElement): boolean {
  return (
    element.classList.contains("react-flow__handle") ||
    element.classList.contains("entity-fields-toggle")
  );
}

/**
 * Bounds of every rendered graph node in flow coordinates (not just the visible
 * part of the canvas), so the exported picture contains the whole graph.
 */
export function measureGraphBounds(root: ParentNode = document): Box | null {
  const viewport = root.querySelector<HTMLElement>(GRAPH_VIEWPORT_SELECTOR);
  if (!viewport) return null;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(GRAPH_NODE_SELECTOR));
  if (nodes.length === 0) return null;

  const viewportRect = viewport.getBoundingClientRect();
  const computed = getComputedStyle(viewport).transform;
  const matrix = computed && computed !== "none" ? new DOMMatrixReadOnly(computed) : new DOMMatrixReadOnly();
  const inverse = matrix.inverse();

  const boxes = nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const topLeft = inverse.transformPoint(
      new DOMPoint(rect.left - viewportRect.left, rect.top - viewportRect.top),
    );
    const bottomRight = inverse.transformPoint(
      new DOMPoint(rect.right - viewportRect.left, rect.bottom - viewportRect.top),
    );
    return boxBetween(topLeft, bottomRight);
  });

  return unionBoxes(boxes);
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

/**
 * Waits until the graph renders with every field list open, so the measured
 * bounds match the picture that is actually captured.
 */
async function waitForExpandedGraph(timeoutMs = 2000): Promise<void> {
  const startedAt = performance.now();
  for (;;) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(GRAPH_NODE_SELECTOR));
    if (nodes.length === 0) return;
    const allExpanded = nodes.every((node) => node.querySelector(".entity-field-list"));
    if (allExpanded || performance.now() - startedAt > timeoutMs) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

/**
 * Rasterises the whole ontology graph into a PNG (2× scale, opaque background).
 * The caller is responsible for expanding the nodes and clearing the selection
 * before calling, so no selection or hover state is captured.
 */
export async function downloadGraphPng(doc: Ontology, root: ParentNode = document): Promise<void> {
  await waitForExpandedGraph();
  const viewport = root.querySelector<HTMLElement>(GRAPH_VIEWPORT_SELECTOR);
  const bounds = measureGraphBounds(root);
  if (!viewport || !bounds) throw new Error("graph is not rendered");

  const geometry = captureGeometry(bounds);
  const dataUrl = await toPng(viewport, {
    width: geometry.width,
    height: geometry.height,
    pixelRatio: 1,
    backgroundColor: PNG_BACKGROUND,
    style: {
      // html-to-image applies `width`/`height` to the clone too, so only the
      // transform (which positions the whole graph at 2×) is overridden here.
      transform: geometry.transform,
      transformOrigin: "0 0",
    },
    filter: (node) => !(node instanceof HTMLElement) || !isExportChrome(node),
  });

  triggerDownload(dataUrl, pngFileName(doc.domain));
}
