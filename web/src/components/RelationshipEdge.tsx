import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useOntologyStore } from "../store";

export type RelationshipEdgeData = {
  name: string;
  fromMark: string;
  toMark: string;
};

const MARK_OFFSET = 22;
const LIFT = 12;

function pointToward(
  x: number,
  y: number,
  towardX: number,
  towardY: number,
  distance: number,
): { x: number; y: number } {
  const dx = towardX - x;
  const dy = towardY - y;
  const len = Math.hypot(dx, dy) || 1;
  const step = Math.min(distance, len / 3);
  return { x: x + (dx / len) * step, y: y + (dy / len) * step };
}

/** Lifts the label above the line so it does not rest on the arrow. */
function above(
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: x + (dy / len) * LIFT, y: y - (dx / len) * LIFT };
}

function at(x: number, y: number) {
  return { transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` };
}

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps<Edge<RelationshipEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const fromPoint = pointToward(sourceX, sourceY, targetX, targetY, MARK_OFFSET);
  const toPoint = pointToward(targetX, targetY, sourceX, sourceY, MARK_OFFSET);
  const from = above(fromPoint.x, fromPoint.y, sourceX, sourceY, targetX, targetY);
  const name = above(labelX, labelY, sourceX, sourceY, targetX, targetY);
  const to = above(toPoint.x, toPoint.y, sourceX, sourceY, targetX, targetY);

  const selectThisEdge = (e: React.MouseEvent) => {
    e.stopPropagation();
    useOntologyStore.getState().setSelection({ kind: "relationship", id });
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <span
          className="edge-mark nodrag nopan"
          style={at(from.x, from.y)}
          onClick={selectThisEdge}
        >
          {data?.fromMark}
        </span>
        <span
          className="edge-name nodrag nopan"
          style={at(name.x, name.y)}
          onClick={selectThisEdge}
        >
          {data?.name}
        </span>
        <span
          className="edge-mark nodrag nopan"
          style={at(to.x, to.y)}
          onClick={selectThisEdge}
        >
          {data?.toMark}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
