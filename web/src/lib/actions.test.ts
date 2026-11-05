import { describe, expect, it } from "vitest";
import type { Action, Ontology } from "../types";
import { actionIdFromName, renameActionInDocument } from "./actions";

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
  from_states: ["draft"],
  to_state: "confirmed",
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
