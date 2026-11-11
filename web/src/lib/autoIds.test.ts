import { describe, expect, it } from "vitest";
import type { Entity, Ontology } from "../types";
import { attributeIdFromName, entityIdFromName, rekeyEntityId, renameAttributeInEntity, repairOntologyIds } from "./autoIds";
import { validateOntology } from "./validate";

const SNAKE_ID = /^[a-z][a-z0-9_]*$/;

describe("entityIdFromName", () => {
  it("uses underscores so the schema accepts an entity name", () => {
    const id = entityIdFromName("New entity", []);
    expect(id).toBe("entity_new_entity");
    expect(id).toMatch(SNAKE_ID);
  });

  it("keeps a second copy unique and valid", () => {
    const first = entityIdFromName("Appointment", []);
    const second = entityIdFromName("Appointment", [{ id: first } as Entity]);
    expect(first).toBe("entity_appointment");
    expect(second).toBe("entity_appointment_2");
    expect(second).toMatch(SNAKE_ID);
  });
});

describe("repairOntologyIds", () => {
  it("replaces a hyphenated entity id already in the document", () => {
    const doc = {
      domain: "demo",
      version: "1.0.0",
      notes: "Demo.",
      entities: [
        {
          id: "client",
          name: "Client",
          primary_key: "id",
          attributes: [{ id: "id", type: "string", name: "Identifier.", required: true }],
        },
        {
          id: "order-item",
          name: "Item",
          primary_key: "line-no",
          attributes: [
            { id: "id", type: "string", name: "Identifier.", required: true },
            { id: "line-no", type: "integer", name: "Number." },
          ],
        },
      ],
      relationships: [],
      actions: [],
      invariants: [],
      open_questions: [],
      out_of_scope: [],
    } as Ontology;
    const repaired = repairOntologyIds(doc).doc;
    expect(repaired.entities[1]?.id).toBe("order_item");
    expect(repaired.entities[1]?.attributes.map((attr) => attr.id)).toEqual(["id", "line_no"]);
    expect(repaired.entities[1]?.primary_key).toBe("line_no");
    expect(validateOntology(repaired)).toEqual([]);
    expect(repairOntologyIds(repaired).doc).toBe(repaired);
  });
});

describe("attributeIdFromName", () => {
  it("does not put hyphens in an attribute id", () => {
    const entity = { id: "order", name: "Order", attributes: [] } as Entity;
    expect(attributeIdFromName("Line number", entity)).toBe("field_line_number");
  });

  it("rebuilds the id from a new name and moves the primary key", () => {
    const entity = {
      id: "order",
      name: "Order",
      primary_key: "phone",
      attributes: [
        { id: "id", type: "string", name: "Identifier.", required: true },
        { id: "phone", type: "string", name: "Field" },
      ],
    } as Entity;
    const next = renameAttributeInEntity(entity, "phone", "Phone");
    expect(next.attributes[1]).toMatchObject({ id: "field_phone", name: "Phone" });
    expect(next.primary_key).toBe("field_phone");
  });

  it("moves the primary key when the key field itself is renamed", () => {
    const entity = {
      id: "order",
      name: "Order",
      primary_key: "id",
      attributes: [{ id: "id", type: "string", name: "Identifier.", required: true }],
    } as Entity;
    const next = renameAttributeInEntity(entity, "id", "Code");
    expect(next.attributes[0]?.id).toBe("field_code");
    expect(next.primary_key).toBe("field_code");
  });

  it("leaves the attribute when the name does not change", () => {
    const entity = {
      id: "order",
      name: "Order",
      attributes: [{ id: "id", type: "string", name: "Identifier.", required: true }],
    } as Entity;
    expect(renameAttributeInEntity(entity, "id", "  Identifier.  ")).toBe(entity);
  });
});

describe("rekeyEntityId with action produces", () => {
  it("updates action produces reference when the produced entity id changes", () => {
    const doc: Ontology = {
      domain: "demo",
      version: "1.0.0",
      notes: "",
      entities: [
        { id: "customer", name: "Customer", attributes: [] },
        { id: "report_old", name: "Report", attributes: [] },
      ],
      relationships: [],
      actions: [
        {
          id: "check",
          name: "Check",
          entity: "customer",
          produces: "report_old",
        },
      ],
      invariants: [],
      open_questions: [],
      out_of_scope: [],
    };

    const rekeyed = rekeyEntityId(doc, "report_old", "report_new");
    expect(rekeyed.actions[0]?.produces).toBe("report_new");
  });
});
