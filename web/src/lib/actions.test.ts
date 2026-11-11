import { describe, expect, it } from "vitest";
import type { Action, Ontology } from "../types";
import { actionIdFromName, renameActionInDocument } from "./actions";
import { parseOntologyYaml, serializeOntology } from "./yaml";
import { validateOntology } from "./validate";

function docWith(actions: Action[]): Ontology {
  return {
    domain: "demo",
    version: "1.0.0",
    notes: "Demo.",
    entities: [],
    relationships: [],
    actions,
    invariants: [],
    open_questions: [],
    out_of_scope: [],
  };
}

const confirm: Action = {
  id: "confirm",
  entity: "order",
  name: "Old",
  requires_confirmation: true,
};

describe("renameActionInDocument", () => {
  it("rebuilds the id from the new name", () => {
    const next = renameActionInDocument(docWith([confirm]), "confirm", "Confirm");
    expect(next.id).toBe("action_confirm");
    expect(next.doc.actions[0]?.name).toBe("Confirm");
  });

  it("adds a suffix when that id is already taken", () => {
    const taken: Action = { ...confirm, id: "action_confirm", name: "Other" };
    const next = renameActionInDocument(docWith([taken, confirm]), "confirm", "Confirm");
    expect(next.id).toBe("action_confirm_2");
  });

  it("leaves the id when the name does not change", () => {
    const doc = docWith([confirm]);
    const next = renameActionInDocument(doc, "confirm", "  Old  ");
    expect(next.id).toBe("confirm");
    expect(next.doc).toBe(doc);
  });

  it("builds a schema-safe id", () => {
    expect(actionIdFromName("Confirm order", [])).toBe("action_confirm_order");
  });
});

describe("OAO security patterns", () => {
  it("round-trips OAO action patterns (roles_allowed, risk_level, warning_prompt, requires_confirmation)", () => {
    const oaoAction: Action = {
      id: "bulk_delete_orders",
      name: "Bulk Delete Orders",
      roles_allowed: ["admin"],
      risk_level: "HIGH",
      requires_confirmation: true,
      warning_prompt: "You are about to permanently delete records. This is irreversible.",
      rule: "only archived orders",
    };
    const doc = docWith([oaoAction]);
    const yaml = serializeOntology(doc);
    expect(yaml).toContain("risk_level: HIGH");
    expect(yaml).toContain("roles_allowed:");
    expect(yaml).toContain("warning_prompt: You are about to permanently delete records.");
    expect(yaml).toContain("requires_confirmation: true");

    const parsed = parseOntologyYaml(yaml);
    expect(parsed.actions[0]).toEqual(oaoAction);

    const issues = validateOntology(parsed);
    expect(issues).toEqual([]);
  });

  it("fails schema validation when an invalid risk_level is supplied", () => {
    const invalidDoc = docWith([
      {
        id: "action_test",
        name: "Test",
        risk_level: "EXTREME" as never,
      },
    ]);
    const issues = validateOntology(invalidDoc);
    expect(issues.some((i) => i.code === "schema" && i.keyword === "enum")).toBe(true);
  });
});

describe("Structured action inputs (tool calling)", () => {
  it("round-trips structured inputs through YAML serialization", () => {
    const actionWithInputs: Action = {
      id: "cancel_order",
      name: "Cancel Order",
      inputs: [
        {
          name: "order_id",
          type: "string",
          required: true,
          description: "Identifier of the order to cancel",
        },
        {
          name: "reason",
          type: "enum",
          required: false,
          description: "Customer or system cancellation reason",
          values: ["customer_request", "out_of_stock", "fraud_detected"],
        },
        {
          name: "notify_client",
          type: "boolean",
          required: false,
        },
      ],
    };

    const doc = docWith([actionWithInputs]);
    const yaml = serializeOntology(doc);
    expect(yaml).toContain("inputs:");
    expect(yaml).toContain("name: order_id");
    expect(yaml).toContain("type: string");
    expect(yaml).toContain("required: true");
    expect(yaml).toContain("description: Identifier of the order to cancel");
    expect(yaml).toContain("values:");
    expect(yaml).toContain("- customer_request");

    const parsed = parseOntologyYaml(yaml);
    expect(parsed.actions[0]?.inputs).toEqual(actionWithInputs.inputs);

    const issues = validateOntology(parsed);
    expect(issues).toEqual([]);
  });

  it("detects duplicate input parameter names", () => {
    const doc = docWith([
      {
        id: "test_action",
        name: "Test Action",
        inputs: [
          { name: "amount", type: "decimal" },
          { name: "amount", type: "integer" },
        ],
      },
    ]);
    const issues = validateOntology(doc);
    expect(issues.some((i) => i.code === "duplicateActionInputName" && i.value === "amount")).toBe(
      true,
    );
  });

  it("validates enum and ref input constraints", () => {
    const invalidEnumDoc = docWith([
      {
        id: "test_enum",
        name: "Test Enum",
        inputs: [{ name: "status", type: "enum", values: [] }],
      },
    ]);
    const enumIssues = validateOntology(invalidEnumDoc);
    expect(enumIssues.some((i) => i.code === "actionInputEnumValuesRequired")).toBe(true);

    const invalidRefDoc = docWith([
      {
        id: "test_ref",
        name: "Test Ref",
        inputs: [{ name: "target", type: "ref", entity: "non_existent_entity" }],
      },
    ]);
    const refIssues = validateOntology(invalidRefDoc);
    expect(refIssues.some((i) => i.code === "actionInputRefEntityUnknown")).toBe(true);
  });
});

describe("action produces entity reference", () => {
  it("round-trips produces field through YAML serialization and passes validation", () => {
    const doc: Ontology = {
      ...docWith([]),
      entities: [
        { id: "customer", name: "Customer", attributes: [] },
        { id: "report", name: "Compliance Report", attributes: [] },
      ],
      actions: [
        {
          id: "verify_compliance",
          name: "Verify Compliance",
          entity: "customer",
          produces: "report",
        },
      ],
    };

    const yaml = serializeOntology(doc);
    expect(yaml).toContain("produces: report");

    const parsed = parseOntologyYaml(yaml);
    expect(parsed.actions[0]?.produces).toBe("report");
    expect(validateOntology(parsed)).toEqual([]);
  });

  it("fails validation when produces points to a non-existent entity", () => {
    const doc: Ontology = {
      ...docWith([]),
      entities: [{ id: "customer", name: "Customer", attributes: [] }],
      actions: [
        {
          id: "verify_compliance",
          name: "Verify Compliance",
          produces: "non_existent_artifact",
        },
      ],
    };

    const issues = validateOntology(doc);
    expect(issues.some((i) => i.code === "actionUnknownProducesEntity" && i.action === "verify_compliance")).toBe(true);
  });
});
