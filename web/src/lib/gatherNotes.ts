import type { Ontology } from "../types";

export type NoteEntry = {
  kind: "doc" | "entity" | "relationship";
  id?: string;
  label: string;
  text: string;
};

function hasText(notes: string | undefined): notes is string {
  return typeof notes === "string" && notes.trim().length > 0;
}

export function gatherNotes(doc: Ontology): NoteEntry[] {
  const out: NoteEntry[] = [];
  if (hasText(doc.notes)) {
    out.push({ kind: "doc", label: "Document", text: doc.notes.trim() });
  }
  for (const entity of doc.entities) {
    if (!hasText(entity.notes)) continue;
    out.push({
      kind: "entity",
      id: entity.id,
      label: entity.name,
      text: entity.notes.trim(),
    });
  }
  for (const rel of doc.relationships) {
    if (!hasText(rel.notes)) continue;
    const fromName = doc.entities.find((e) => e.id === rel.from)?.name ?? rel.from;
    const toName = doc.entities.find((e) => e.id === rel.to)?.name ?? rel.to;
    out.push({
      kind: "relationship",
      id: rel.id,
      label: `${fromName} → ${toName} · ${rel.name}`,
      text: rel.notes.trim(),
    });
  }
  return out;
}
