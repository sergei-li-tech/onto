import { describe, expect, it } from "vitest";
import type { Action } from "../types";
import {
  addActionPhrase,
  addInvariantPhrase,
  addPhrase,
  editActionPhrase,
  editInvariantPhrase,
  editPhrase,
  setActionRule,
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

describe("invariant phrases", () => {
  it("stores a sentence as one invariant", () => {
    const invariants = addInvariantPhrase([], "Order can be cancelled");
    expect(invariants).toEqual([
      { id: "invariant-order-can-be-cancelled", statement: "Order can be cancelled" },
    ]);
  });

  it("rebuilds the id when the sentence changes", () => {
    const invariants = editInvariantPhrase(
      [{ id: "invariant-old", statement: "Old" }],
      "invariant-old",
      "New invariant",
    );
    expect(invariants[0]).toEqual({
      id: "invariant-new-invariant",
      statement: "New invariant",
    });
  });
});

describe("action rule", () => {
  it("stores and clears the local rule without touching other fields", () => {
    const current: Action = { id: "confirm", name: "Confirm", entity: "order" };
    const withRule = setActionRule([current], "confirm", "  payment received  ");
    expect(withRule[0]).toEqual({
      id: "confirm",
      name: "Confirm",
      entity: "order",
      rule: "payment received",
    });
    const cleared = setActionRule(withRule, "confirm", "   ");
    expect(cleared[0]).toEqual({ id: "confirm", name: "Confirm", entity: "order" });
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
      requires_confirmation: true,
    };
    const actions = editActionPhrase([current], "confirm", "Confirm");
    expect(actions[0]).toMatchObject({
      id: "action_confirm",
      name: "Confirm",
      entity: "order",
      requires_confirmation: true,
    });
  });
});
