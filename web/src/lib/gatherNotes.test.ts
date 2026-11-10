import { describe, expect, it } from "vitest";
import { gatherNotes } from "./gatherNotes";
import type { Ontology } from "../types";

const base: Ontology = {
  domain: "d",
  version: "1.0.0",
  notes: "",
  entities: [{ id: "a", name: "Alpha", attributes: [{ id: "id", type: "string", name: "Name" }] }],
  relationships: [],
  actions: [],
  invariants: [],
  open_questions: [],
  out_of_scope: [],
};

describe("gatherNotes", () => {
  it("collects doc, entity, and relationship notes", () => {
    const doc: Ontology = {
      ...base,
      notes: "  Global  ",
      entities: [{ ...base.entities[0]!, notes: "Entity note" }],
      relationships: [
        {
          id: "r1",
          from: "a",
          to: "a",
          name: "loop",
          cardinality: "0..1",
          notes: "Rel note",
        },
      ],
    };
    expect(gatherNotes(doc)).toEqual([
      { kind: "doc", label: "Document", text: "Global" },
      { kind: "entity", id: "a", label: "Alpha", text: "Entity note" },
      { kind: "relationship", id: "r1", label: "Alpha → Alpha · loop", text: "Rel note" },
    ]);
  });

  it("skips empty notes", () => {
    expect(gatherNotes({ ...base, notes: "  \n  " })).toEqual([]);
  });
});
