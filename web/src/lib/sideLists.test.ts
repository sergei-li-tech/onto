import { describe, expect, it } from "vitest";
import type { Action } from "../types";
import {
  addActionPhrase,
  addPhrase,
  addRulePhrase,
  editActionPhrase,
  editPhrase,
  editRulePhrase,
} from "./sideLists";

describe("phrase lists", () => {
  it("keeps spaces inside one phrase", () => {
    expect(addPhrase([], "new client")).toEqual(["new client"]);
  });

  it("ignores a blank phrase", () => {
    expect(addPhrase(["already"], "  ")).toEqual(["already"]);
  });

  it("replaces one phrase without trimming the words apart", () => {
    expect(editPhrase(["draft"], 0, "  when paid  ")).toEqual(["when paid"]);
  });
});

describe("rule phrases", () => {
  it("stores a sentence as one rule", () => {
    const rules = addRulePhrase([], "Order can be cancelled");
    expect(rules).toEqual([
      { id: "rule-order-can-be-cancelled", statement: "Order can be cancelled" },
    ]);
  });

  it("rebuilds the id when the sentence changes", () => {
    const rules = editRulePhrase(
      [{ id: "rule-old", statement: "Old" }],
      "rule-old",
      "New rule",
    );
    expect(rules[0]).toEqual({ id: "rule-new-rule", statement: "New rule" });
  });
});

describe("action phrases", () => {
  it("stores only the name", () => {
    const actions = addActionPhrase([], "Confirm order");
    expect(actions).toEqual([{ id: "action_confirm_order", name: "Confirm order" }]);
  });

  it("keeps the other fields when the name changes", () => {
    const current: Action = {
      id: "confirm",
      name: "Old",
      entity: "order",
      from_states: ["draft"],
      to_state: "confirmed",
      requires_confirmation: true,
    };
    const actions = editActionPhrase([current], "confirm", "Confirm");
    expect(actions[0]).toMatchObject({
      id: "action_confirm",
      name: "Confirm",
      entity: "order",
      to_state: "confirmed",
    });
  });
});
