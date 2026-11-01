import { describe, expect, it } from "vitest";
import type { Ontology, Relationship } from "../types";
import { applyOperations } from "./applyOperations";
import { operationsInRelationshipScope, relationshipIdAfterApply } from "./relationshipScope";

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

describe("operationsInRelationshipScope", () => {
  it("keeps the link word and counts, and drops the ends", () => {
    const kept = operationsInRelationshipScope("rel-old", [
      {
        op: "update_relationship",
        id: "rel-old",
        patch: { name: "provides", from_min: "0", to_max: "many", from: "other", to: "other" },
      },
      { op: "update_relationship", id: "rel-other", patch: { name: "no" } },
      { op: "add_entity", entity: { id: "order" } },
      { op: "update_relationship", id: "rel-old", patch: { from_min: "2" } },
    ]);
    expect(kept).toEqual([
      {
        op: "update_relationship",
        id: "rel-old",
        patch: { name: "provides", from_min: "0", to_max: "many" },
      },
    ]);
  });

  it("applies the kept counts without moving the link", () => {
    const doc = docWith([link("rel-old", "provides")]);
    const ops = operationsInRelationshipScope("rel-old", [
      {
        op: "update_relationship",
        id: "rel-old",
        patch: { from_min: "0", from_max: "1", to_min: "0", to_max: "1", from: "other" },
      },
    ]);
    const next = applyOperations(doc, ops);
    expect(next.relationships[0]).toMatchObject({
      id: "rel-old",
      from: "client",
      to: "visit",
      name: "provides",
      from_min: "0",
      from_max: "1",
      to_min: "0",
      to_max: "1",
    });
  });
});

describe("relationshipIdAfterApply", () => {
  it("follows the id when the link word changes", () => {
    const doc = docWith([link("rel-old", "relates to")]);
    const ops = operationsInRelationshipScope("rel-old", [
      { op: "update_relationship", id: "rel-old", patch: { name: "books" } },
    ]);
    const next = applyOperations(doc, ops);
    expect(relationshipIdAfterApply(doc, next, "rel-old", ops)).toBe(
      "rel-client-books-visit",
    );
  });

  it("keeps the id when only the counts change", () => {
    const doc = docWith([link("rel-old", "provides")]);
    const ops = [{ op: "update_relationship", id: "rel-old", patch: { from_min: "0" } }];
    const next = applyOperations(doc, ops);
    expect(relationshipIdAfterApply(doc, next, "rel-old", ops)).toBe("rel-old");
  });
});
