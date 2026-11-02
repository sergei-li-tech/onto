import { describe, expect, it } from "vitest";
import type { Ontology, Relationship } from "../types";
import { renameRelationshipInDocument } from "./relationships";

function docWith(relationships: Relationship[]): Ontology {
  return {
    domain: "demo",
    version: "1.0.0",
    notes: "Demo.",
    entities: [],
    relationships,
    actions: [],
    rules: [],
    open_questions: [],
    out_of_scope: [],
  };
}

const link = (id: string, name: string): Relationship => ({
  id,
  from: "client",
  to: "visit",
  name,
  from_min: "1",
  from_max: "1",
  to_min: "0",
  to_max: "many",
});

describe("renameRelationshipInDocument", () => {
  it("rebuilds the id from the new name", () => {
    const doc = docWith([link("rel-old", "relates to")]);
    const next = renameRelationshipInDocument(doc, "rel-old", "books");
    expect(next.id).toBe("rel-client-books-visit");
    expect(next.doc.relationships[0]?.name).toBe("books");
  });

  it("adds a suffix when that id is already taken", () => {
    const doc = docWith([
      link("rel-client-books-visit", "other"),
      link("rel-old", "relates to"),
    ]);
    const next = renameRelationshipInDocument(doc, "rel-old", "books");
    expect(next.id).toBe("rel-client-books-visit-2");
  });

  it("leaves the id when the name does not change", () => {
    const doc = docWith([link("rel-old", "relates to")]);
    const next = renameRelationshipInDocument(doc, "rel-old", "  relates to  ");
    expect(next.id).toBe("rel-old");
    expect(next.doc).toBe(doc);
  });
});
