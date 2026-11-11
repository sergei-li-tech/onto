import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOperations } from "./applyOperations";
import { operationsInEntityScope } from "./entityScope";
import { pruneUnrequestedEntityAttributes } from "./pruneEntityAttributes";
import { parseOntologyYaml } from "./yaml";
import { validateOntology } from "./validate";

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../templates");

describe("applyOperations", () => {
  it("adds entity from AI op", () => {
    const doc = parseOntologyYaml(readFileSync(join(templatesDir, "generic.yaml"), "utf8"));
    const next = applyOperations(doc, [
      {
        op: "add_entity",
        entity: {
          id: "order",
          name: "Order",
          primary_key: "id",
          attributes: [
            { id: "id", type: "string", name: "ID", required: true },
            {
              id: "status",
              type: "enum",
              name: "Status",
              required: true,
              values: ["draft", "confirmed"],
            },
          ],
        },
      },
    ]);
    expect(next.entities.some((e) => e.id === "order")).toBe(true);
    expect(validateOntology(next)).toEqual([]);
  });

  it("keeps only operations on the selected entity", () => {
    const doc = parseOntologyYaml(readFileSync(join(templatesDir, "generic.yaml"), "utf8"));
    const entityId = doc.entities[0].id;
    const kept = operationsInEntityScope(doc, entityId, [
      { op: "update_entity", id: entityId, patch: { name: "Leads." } },
      { op: "add_attribute", entity_id: entityId, attribute: { id: "phone", type: "string", name: "Phone" } },
      { op: "add_entity", entity: { id: "order", name: "Order" } },
      { op: "update_entity", id: "order", patch: { name: "Deal" } },
      { op: "remove_entity", id: entityId },
      {
        op: "add_relationship",
        relationship: { id: "r1", from: entityId, to: "order", name: "places" },
      },
      {
        op: "add_relationship",
        relationship: { id: "r2", from: "order", to: "invoice", name: "has" },
      },
    ]);
    expect(kept.map((op) => (op as { op: string }).op)).toEqual([
      "update_entity",
      "add_attribute",
      "add_relationship",
    ]);
  });

  it("drops fields the request did not name, including default id", () => {
    const doc = parseOntologyYaml(readFileSync(join(templatesDir, "generic.yaml"), "utf8"));
    const bare = pruneUnrequestedEntityAttributes("Add entity Order", [
      {
        op: "add_entity",
        entity: {
          id: "order",
          name: "Order",
          primary_key: "id",
          attributes: [
            { id: "id", type: "string", name: "Unique identifier of order", required: true },
            { id: "status", type: "enum", name: "Current state", values: ["draft"] },
          ],
        },
      },
      {
        op: "add_attribute",
        entity_id: "order",
        attribute: { id: "phone", type: "string", name: "Phone" },
      },
    ]);
    const bareEntity = (bare[0] as { entity: { attributes: { id: string }[]; primary_key?: string } }).entity;
    expect(bareEntity.attributes).toEqual([]);
    expect(bareEntity.primary_key).toBeUndefined();
    expect(bare).toHaveLength(1);

    const named = pruneUnrequestedEntityAttributes("Add entity Order with field phone", [
      {
        op: "add_entity",
        entity: {
          id: "order",
          name: "Order",
          primary_key: "phone",
          attributes: [
            { id: "id", type: "string", name: "Unique identifier" },
            { id: "phone", type: "string", name: "Phone" },
            { id: "note", type: "string", name: "Comment" },
          ],
        },
      },
    ]);
    const namedEntity = (named[0] as { entity: { attributes: { id: string }[]; primary_key?: string } }).entity;
    expect(namedEntity.attributes.map((a) => a.id)).toEqual(["phone"]);
    expect(namedEntity.primary_key).toBe("phone");

    const next = applyOperations(doc, [
      { op: "add_entity", entity: { id: "order", name: "Order" } },
    ]);
    const created = next.entities.find((e) => e.id === "order");
    expect(created?.attributes).toEqual([]);
    expect(created?.primary_key).toBeUndefined();
    expect(validateOntology(next)).toEqual([]);
  });

  it("rewrites a hyphenated entity id into snake_case", () => {
    const doc = parseOntologyYaml(readFileSync(join(templatesDir, "generic.yaml"), "utf8"));
    const next = applyOperations(doc, [
      {
        op: "add_entity",
        entity: {
          id: "order-item",
          name: "Item",
          primary_key: "line-no",
          attributes: [
            { id: "id", type: "string", name: "Identifier.", required: true },
            { id: "line-no", type: "integer", name: "Number." },
          ],
        },
      },
      {
        op: "add_relationship",
        relationship: {
          id: "client-has-item",
          from: "client",
          to: "order-item",
          name: "contains",
          cardinality: "0..*",
        },
      },
    ]);
    const created = next.entities.find((e) => e.name === "Item");
    expect(created?.id).toBe("order_item");
    expect(created?.attributes.map((a) => a.id)).toEqual(["id", "line_no"]);
    expect(created?.primary_key).toBe("line_no");
    expect(next.relationships.at(-1)?.to).toBe("order_item");
    expect(validateOntology(next)).toEqual([]);
  });

  it("rebuilds an attribute id when its name changes", () => {
    const doc = parseOntologyYaml(readFileSync(join(templatesDir, "generic.yaml"), "utf8"));
    const next = applyOperations(doc, [
      {
        op: "add_attribute",
        entity_id: "client",
        attribute: { id: "contact", type: "string", name: "Contact" },
      },
      {
        op: "update_attribute",
        entity_id: "client",
        attribute_id: "contact",
        patch: { name: "Phone" },
      },
    ]);
    const client = next.entities.find((e) => e.id === "client");
    expect(client?.attributes.map((attr) => attr.id)).toEqual(["field_phone"]);
    expect(client?.attributes[0]?.name).toBe("Phone");
    expect(client?.primary_key).toBe("field_phone");
    expect(validateOntology(next)).toEqual([]);
  });

  it("preserves pii flag on add_attribute and update_attribute", () => {
    const doc = parseOntologyYaml(readFileSync(join(templatesDir, "generic.yaml"), "utf8"));
    const next = applyOperations(doc, [
      {
        op: "add_attribute",
        entity_id: "client",
        attribute: { id: "passport", type: "string", name: "Passport", pii: true },
      },
      {
        op: "update_attribute",
        entity_id: "client",
        attribute_id: "passport",
        patch: { pii: true, required: true },
      },
    ]);
    const client = next.entities.find((e) => e.id === "client");
    expect(client?.attributes[0]?.pii).toBe(true);
    expect(client?.attributes[0]?.required).toBe(true);
    expect(validateOntology(next)).toEqual([]);
  });
});
