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
    invariants: [],
    open_questions: [],
    out_of_scope: [],
  };
}

const link = (id: string, name: string): Relationship => ({
  id,
  from: "client",
  to: "visit",
  name,
  cardinality: "0..*",
});

describe("operationsInRelationshipScope", () => {
  it("keeps the link word and cardinality, and drops the ends", () => {
    const kept = operationsInRelationshipScope("rel-old", [
      {
        op: "update_relationship",
        id: "rel-old",
        patch: { name: "provides", cardinality: "0..1", from: "other", to: "other" },
      },
      { op: "update_relationship", id: "rel-other", patch: { name: "no" } },
      { op: "add_entity", entity: { id: "order" } },
      { op: "update_relationship", id: "rel-old", patch: { invalid_key: "2" } },
    ]);
    expect(kept).toEqual([
      {
        op: "update_relationship",
        id: "rel-old",
        patch: { name: "provides", cardinality: "0..1" },
      },
    ]);
  });

  it("applies the kept cardinality without moving the link", () => {
    const doc = docWith([link("rel-old", "provides")]);
    const ops = operationsInRelationshipScope("rel-old", [
      {
        op: "update_relationship",
        id: "rel-old",
        patch: { cardinality: "0..1", from: "other" },
      },
    ]);
    const next = applyOperations(doc, ops);
    expect(next.relationships[0]).toMatchObject({
      id: "rel-old",
      from: "client",
      to: "visit",
      name: "provides",
      cardinality: "0..1",
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

  it("keeps the id when only the cardinality changes", () => {
    const doc = docWith([link("rel-old", "provides")]);
    const ops = [{ op: "update_relationship", id: "rel-old", patch: { cardinality: "1..*" } }];
    const next = applyOperations(doc, ops);
    expect(relationshipIdAfterApply(doc, next, "rel-old", ops)).toBe("rel-old");
    expect(next.relationships[0]?.cardinality).toBe("1..*");
  });
});
