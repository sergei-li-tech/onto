import ELK from "elkjs/lib/elk.bundled.js";
import type { Entity, LayoutNode, Ontology } from "../types";

const elk = new ELK();

const LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "72",
  "elk.spacing.edgeNode": "40",
  "elk.spacing.edgeEdge": "24",
  "elk.layered.spacing.nodeNodeBetweenLayers": "180",
  "elk.layered.spacing.edgeNodeBetweenLayers": "56",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.thoroughness": "10",
  "elk.separateConnectedComponents": "true",
  "elk.spacing.componentComponent": "96",
} as const;

/** Size hint for ELK — slightly larger than collapsed graph nodes to reduce overlap. */
export function entityLayoutSize(entity: Pick<Entity, "attributes">): {
  width: number;
  height: number;
} {
  const n = entity.attributes.length;
  return {
    width: 200,
    height: Math.max(64, 48 + Math.min(n, 10) * 20),
  };
}

export async function autoLayoutEntities(doc: Ontology): Promise<LayoutNode[]> {
  const graph = {
    id: "root",
    layoutOptions: { ...LAYOUT_OPTIONS },
    children: doc.entities.map((e) => {
      const size = entityLayoutSize(e);
      return {
        id: e.id,
        width: size.width,
        height: size.height,
      };
    }),
    edges: doc.relationships.map((r) => ({
      id: r.id,
      sources: [r.from],
      targets: [r.to],
    })),
  };

  const laid = await elk.layout(graph);
  const nodes: LayoutNode[] = [];
  for (const child of laid.children ?? []) {
    nodes.push({
      id: child.id,
      x: child.x ?? 0,
      y: child.y ?? 0,
    });
  }
  return nodes;
}

export function layoutPositions(doc: Ontology): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  for (const n of doc.layout?.nodes ?? []) {
    map.set(n.id, { x: n.x, y: n.y });
  }
  let i = 0;
  for (const e of doc.entities) {
    if (!map.has(e.id)) {
      map.set(e.id, { x: (i % 4) * 240, y: Math.floor(i / 4) * 140 });
      i += 1;
    }
  }
  return map;
}
