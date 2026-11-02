import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useT } from "../i18n";

export type EntityNodeData = {
  label: string;
  uniqueIdentifier: string;
  aliases: string[];
  attributes: { id: string; name: string }[];
  expanded: boolean;
  onToggle: () => void;
};

function EntityNodeComponent({ data }: NodeProps<EntityNodeData>) {
  const t = useT();
  return (
    <div className="entity-flow-node">
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        isConnectable
        className="entity-handle"
      />
      <div className="entity-node-title">
        <span>{data.label}</span>
        <button
          type="button"
          className="entity-fields-toggle nodrag nopan"
          aria-expanded={data.expanded}
          aria-label={data.expanded ? t("entityNode.hideFields") : t("entityNode.showFields")}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle();
          }}
        >
          {data.expanded ? "▾" : "▸"}
        </button>
      </div>
      {data.uniqueIdentifier ? (
        <p className="entity-node-unique-id" title={t("detail.uniqueIdentifier")}>
          {data.uniqueIdentifier}
        </p>
      ) : null}
      {data.aliases.length > 0 ? (
        <p className="entity-node-aliases" title={t("entityNode.aliases")}>
          {data.aliases.join(" · ")}
        </p>
      ) : null}
      {data.expanded ? (
        <ul className="entity-field-list nodrag nopan">
          {data.attributes.length === 0 ? (
            <li className="entity-field-empty">{t("entityNode.noFields")}</li>
          ) : (
            data.attributes.map((attr) => (
              <li key={attr.id} className="entity-field-item">
                {attr.name}
              </li>
            ))
          )}
        </ul>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        isConnectable
        className="entity-handle"
      />
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
