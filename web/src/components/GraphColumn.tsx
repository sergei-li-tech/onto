import { useRef } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { Ontology } from "../types";
import { viewportCenterScreenPoint } from "../lib/graphPlacement";
import { useOntologyStore } from "../store";
import { OntologyGraph } from "./OntologyGraph";

function AddEntityButton({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const addEntity = useOntologyStore((s) => s.addEntity);
  const { screenToFlowPosition } = useReactFlow();

  return (
    <button
      type="button"
      className="list-item"
      onClick={() => {
        const canvas = canvasRef.current;
        if (!canvas) {
          addEntity();
          return;
        }
        const center = viewportCenterScreenPoint(canvas.getBoundingClientRect());
        addEntity(screenToFlowPosition(center));
      }}
    >
      + Entity
    </button>
  );
}

export function GraphColumn({ doc }: { doc: Ontology }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <ReactFlowProvider>
      <div className="graph-column">
        <div className="graph-column-toolbar tech-only">
          <AddEntityButton canvasRef={canvasRef} />
        </div>
        <div className="graph-column-canvas" ref={canvasRef}>
          <OntologyGraph doc={doc} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
