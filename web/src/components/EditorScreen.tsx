import { useEffect, useRef, useState } from "react";
import type { Ontology } from "../types";
import { TopBar } from "./TopBar";
import { EntitySidebar } from "./EntitySidebar";
import { GraphColumn } from "./GraphColumn";
import { AiChatPanel, DraftAssistant } from "./AiChatPanel";
import { DetailPanel } from "./DetailPanel";
import { nextPanelWidth } from "../lib/panelSize";
import { useUnsavedLeaveGuard } from "../lib/unsavedChanges";
import { useOntologyStore } from "../store";

const LEFT_DEFAULT = 260;
const RIGHT_DEFAULT = 360;
const LEFT_MIN = 180;
const RIGHT_MIN = 280;
const CENTER_MIN = 220;

export function EditorScreen({ doc }: { doc: Ontology }) {
  useUnsavedLeaveGuard();
  const repairIds = useOntologyStore((s) => s.repairIds);
  const gridRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);

  function resizeLeft(clientX: number) {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return;
    setLeftWidth(nextPanelWidth(clientX - box.left, LEFT_MIN, box.width, rightWidth, CENTER_MIN));
  }

  function resizeRight(clientX: number) {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return;
    setRightWidth(nextPanelWidth(box.right - clientX, RIGHT_MIN, box.width, leftWidth, CENTER_MIN));
  }

  useEffect(() => {
    repairIds();
  }, [doc, repairIds]);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="editor-workspace">
        <div
          className={`main-grid${dragging ? " is-resizing" : ""}`}
          ref={gridRef}
          style={{ gridTemplateColumns: `${leftWidth}px minmax(0, 1fr) ${rightWidth}px` }}
        >
          <EntitySidebar doc={doc} />
          <PanelResize
            label="Left panel width"
            dragging={dragging === "left"}
            style={{ left: leftWidth - 4 }}
            onDragStart={() => setDragging("left")}
            onDrag={resizeLeft}
            onDragEnd={() => setDragging(null)}
          />
          <GraphColumn doc={doc} />
          <PanelResize
            label="Right panel width"
            dragging={dragging === "right"}
            style={{ right: rightWidth - 4 }}
            onDragStart={() => setDragging("right")}
            onDrag={resizeRight}
            onDragEnd={() => setDragging(null)}
          />
          <div className="right-column">
            <DraftAssistant doc={doc} />
            <AiChatPanel doc={doc} />
            <DetailPanel doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelResize({
  label,
  dragging,
  style,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  label: string;
  dragging: boolean;
  style: { left?: number; right?: number };
  onDragStart: () => void;
  onDrag: (clientX: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className="panel-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-dragging={dragging || undefined}
      style={style}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDragStart();
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        onDrag(e.clientX);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        onDragEnd();
      }}
      onPointerCancel={onDragEnd}
    />
  );
}
