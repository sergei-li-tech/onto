import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeDragHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Ontology } from "../types";
import { formatCardinality, getRelationshipBounds } from "../lib/cardinality";
import { layoutPositions } from "../lib/layoutElk";
import { useOntologyStore } from "../store";
import { EntityNode } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { useT } from "../i18n";

const nodeTypes = { entity: EntityNode };
const edgeTypes = { relationship: RelationshipEdge };

function buildFlowNodes(
  doc: Ontology,
  positions: Map<string, { x: number; y: number }>,
  selection: ReturnType<typeof useOntologyStore.getState>["selection"],
  expandedId: string | null,
  onToggle: (id: string) => void,
): Node[] {
  return doc.entities.map((e) => {
    const pos = positions.get(e.id) ?? { x: 0, y: 0 };
    const selected = selection?.kind === "entity" && selection.id === e.id;
    const expanded = expandedId === e.id;
    return {
      id: e.id,
      type: "entity",
      position: pos,
      data: {
        label: e.name,
        uniqueIdentifier: e.unique_identifier?.trim() ?? "",
        aliases: e.aliases ?? [],
        attributes: e.attributes.map((attr) => ({
          id: attr.id,
          name: attr.name,
          pii: attr.pii,
        })),
        expanded,
        onToggle: () => onToggle(e.id),
      },
      selected,
      connectable: true,
      zIndex: expanded ? 5 : 0,
      style: {
        borderRadius: 10,
        border: selected ? "2px solid #2563eb" : "1px solid #cbd5e1",
        padding: 0,
        background: "#fff",
        fontWeight: 500,
        minWidth: 120,
        textAlign: "center" as const,
      },
    };
  });
}

function buildFlowEdges(
  doc: Ontology,
  selection: ReturnType<typeof useOntologyStore.getState>["selection"],
): Edge[] {
  return doc.relationships.map((r) => {
    const { from_min, from_max, to_min, to_max } = getRelationshipBounds(r.cardinality);
    return {
      id: r.id,
      source: r.from,
      target: r.to,
      type: "relationship",
      data: {
        name: r.name,
        fromMark: formatCardinality(from_min, from_max),
        toMark: formatCardinality(to_min, to_max),
      },
      animated: selection?.kind === "relationship" && selection.id === r.id,
      style: { stroke: "#64748b" },
    };
  });
}

export function OntologyGraph({ doc }: { doc: Ontology }) {
  const setSelection = useOntologyStore((s) => s.setSelection);
  const t = useT();
  const updateNodePosition = useOntologyStore((s) => s.updateNodePosition);
  const addRelationship = useOntologyStore((s) => s.addRelationship);
  const selection = useOntologyStore((s) => s.selection);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleFields = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  useEffect(() => {
    if (expandedId && !doc.entities.some((entity) => entity.id === expandedId)) {
      setExpandedId(null);
    }
  }, [doc, expandedId]);

  const positions = useMemo(() => layoutPositions(doc), [doc]);

  const flowNodes = useMemo(
    () => buildFlowNodes(doc, positions, selection, expandedId, toggleFields),
    [doc, positions, selection, expandedId, toggleFields],
  );

  const flowEdges = useMemo(
    () => buildFlowEdges(doc, selection),
    [doc, selection],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      setSelection({ kind: "entity", id: node.id });
    },
    [setSelection],
  );

  const onEdgeClick = useCallback(
    (_: MouseEvent, edge: Edge) => {
      setSelection({ kind: "relationship", id: edge.id });
    },
    [setSelection],
  );

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node) => {
      updateNodePosition(node.id, node.position.x, node.position.y);
    },
    [updateNodePosition],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      addRelationship(connection.source, connection.target, t("graph.defaultRelationship"));
    },
    [addRelationship, t],
  );

  return (
    <div className="graph-pane" style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e2e8f0" />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
