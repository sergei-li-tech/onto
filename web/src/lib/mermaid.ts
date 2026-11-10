import type { Cardinality, Entity, Ontology, Relationship } from "../types";
import { getRelationshipBounds, numericBound } from "./cardinality";

function sanitizeToken(str: string): string {
  const cleaned = str.replace(/[^a-zA-Z0-9_]/g, "_");
  return cleaned || "node";
}

function escapeLabel(str: string): string {
  return str.replace(/"/g, "'").trim();
}

/**
 * Maps our cardinality (0 | 1 | * | N..M) to Mermaid ER notation:
 * Left side (from):
 *   1..1 -> ||
 *   0..1 -> |o
 *   1..* -> }|
 *   0..* -> }o
 * Right side (to):
 *   1..1 -> ||
 *   0..1 -> o|
 *   1..* -> |{
 *   0..* -> o{
 */
function erLeftSymbol(min?: Cardinality, max?: Cardinality): string {
  const numMin = numericBound(min ?? "1");
  const numMax = numericBound(max ?? "1");
  const isZero = numMin === 0;
  const isMany = numMax > 1;
  if (isMany) {
    return isZero ? "}o" : "}|";
  }
  return isZero ? "|o" : "||";
}

function erRightSymbol(min?: Cardinality, max?: Cardinality): string {
  const numMin = numericBound(min ?? "0");
  const numMax = numericBound(max ?? "*");
  const isZero = numMin === 0;
  const isMany = numMax > 1;
  if (isMany) {
    return isZero ? "o{" : "|{";
  }
  return isZero ? "o|" : "||";
}

/**
 * Export ontology as Mermaid ER Diagram.
 */
export function exportMermaidER(doc: Ontology): string {
  const lines: string[] = ["erDiagram"];

  for (const entity of doc.entities) {
    const id = sanitizeToken(entity.id);
    if (entity.attributes.length > 0) {
      lines.push(`    ${id} {`);
      for (const attr of entity.attributes) {
        let typeStr: string = attr.type;
        if (attr.type === "enum" && attr.values?.length) {
          typeStr = "enum";
        } else if (attr.type === "ref" && attr.entity) {
          typeStr = sanitizeToken(attr.entity);
        }
        const fieldName = sanitizeToken(attr.id);
        const comment = attr.name && attr.name !== attr.id ? ` "${escapeLabel(attr.name)}"` : "";
        lines.push(`        ${typeStr} ${fieldName}${comment}`);
      }
      lines.push("    }");
    } else {
      lines.push(`    ${id}`);
    }
  }

  for (const rel of doc.relationships) {
    const fromId = sanitizeToken(rel.from);
    const toId = sanitizeToken(rel.to);
    const bounds = getRelationshipBounds(rel.cardinality);
    const left = erLeftSymbol(bounds.from_min, bounds.from_max);
    const right = erRightSymbol(bounds.to_min, bounds.to_max);
    const label = rel.name ? ` : "${escapeLabel(rel.name)}"` : " : relates";
    lines.push(`    ${fromId} ${left}--${right} ${toId}${label}`);
  }

  return lines.join("\n");
}

/**
 * Export ontology as Mermaid Flowchart (Entities, Relationships, and Actions).
 */
export function exportMermaidFlowchart(doc: Ontology): string {
  const lines: string[] = ["flowchart TD"];

  if (doc.entities.length > 0) {
    lines.push("    subgraph Entities");
    for (const entity of doc.entities) {
      const id = sanitizeToken(entity.id);
      const label = escapeLabel(entity.name || entity.id);
      lines.push(`        ${id}["${label}"]`);
    }
    lines.push("    end");
  }

  for (const rel of doc.relationships) {
    const fromId = sanitizeToken(rel.from);
    const toId = sanitizeToken(rel.to);
    const label = escapeLabel(rel.name || "");
    if (label) {
      lines.push(`    ${fromId} -->|"${label}"| ${toId}`);
    } else {
      lines.push(`    ${fromId} --> ${toId}`);
    }
  }

  if (doc.actions.length > 0) {
    lines.push("    subgraph Actions");
    for (const action of doc.actions) {
      const actId = `act_${sanitizeToken(action.id)}`;
      const label = escapeLabel(action.name || action.id);
      lines.push(`        ${actId}(["${label}"])`);
    }
    lines.push("    end");

    for (const action of doc.actions) {
      const actId = `act_${sanitizeToken(action.id)}`;
      if (action.entity) {
        const entId = sanitizeToken(action.entity);
        lines.push(`    ${entId} -.-> ${actId}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Export ontology state transitions as Mermaid State Diagram.
 */
export function exportMermaidStateDiagram(doc: Ontology): string {
  const lines: string[] = ["stateDiagram-v2"];

  // Group actions by entity
  const actionsByEntity = new Map<string, typeof doc.actions>();
  for (const a of doc.actions) {
    const entKey = a.entity || "__global__";
    const list = actionsByEntity.get(entKey) ?? [];
    list.push(a);
    actionsByEntity.set(entKey, list);
  }

  // Find entities with enum attributes or actions
  let hasStates = false;

  for (const entity of doc.entities) {
    const enumAttr = entity.attributes.find(
      (a) => a.type === "enum" && a.values?.length,
    );
    const entActions = actionsByEntity.get(entity.id) ?? [];

    if (!enumAttr && entActions.length === 0) {
      continue;
    }

    hasStates = true;
    const entId = sanitizeToken(entity.id);
    const entTitle = escapeLabel(entity.name || entity.id);
    lines.push(`    state "${entTitle}" as ${entId}_states {`);

    const states = enumAttr?.values ?? [];
    if (states.length > 0) {
      lines.push(`        [*] --> ${sanitizeToken(states[0])}`);
    }

    // Connect transitions if action defines states (legacy compatibility) or sequence of enum values
    const transitionsRendered = new Set<string>();
    for (const act of entActions) {
      const raw = act as Record<string, unknown>;
      const fromStates = Array.isArray(raw.from_states) ? (raw.from_states as string[]) : [];
      const toState = typeof raw.to_state === "string" ? raw.to_state : null;
      const actLabel = escapeLabel(act.name);

      if (fromStates.length > 0 && toState) {
        for (const fromS of fromStates) {
          const transKey = `${fromS}->${toState}:${actLabel}`;
          transitionsRendered.add(transKey);
          lines.push(
            `        ${sanitizeToken(fromS)} --> ${sanitizeToken(toState)} : ${actLabel}`,
          );
        }
      } else if (toState) {
        lines.push(`        [*] --> ${sanitizeToken(toState)} : ${actLabel}`);
      }
    }

    // If there were enum states with no explicit transition, show lifecycle order
    if (states.length > 1 && transitionsRendered.size === 0) {
      for (let i = 0; i < states.length - 1; i++) {
        const actionLabel = entActions[i]?.name ? ` : ${escapeLabel(entActions[i].name)}` : "";
        lines.push(
          `        ${sanitizeToken(states[i])} --> ${sanitizeToken(states[i + 1])}${actionLabel}`,
        );
      }
    }

    lines.push("    }");
  }

  // If there are actions without an entity or without entity states
  const globalActions = actionsByEntity.get("__global__") ?? [];
  if (globalActions.length > 0) {
    hasStates = true;
    for (const act of globalActions) {
      const actLabel = escapeLabel(act.name);
      lines.push(`    [*] --> ${sanitizeToken(act.id)} : ${actLabel}`);
    }
  }

  // Fallback if no explicit states found
  if (!hasStates) {
    if (doc.entities.length > 0) {
      for (const e of doc.entities) {
        lines.push(`    [*] --> ${sanitizeToken(e.id)}`);
      }
    } else {
      lines.push("    [*] --> Empty");
    }
  }

  return lines.join("\n");
}

export type MermaidExportType = "er" | "flowchart" | "states";

export function exportMermaid(doc: Ontology, type: MermaidExportType): string {
  switch (type) {
    case "er":
      return exportMermaidER(doc);
    case "flowchart":
      return exportMermaidFlowchart(doc);
    case "states":
      return exportMermaidStateDiagram(doc);
  }
}
