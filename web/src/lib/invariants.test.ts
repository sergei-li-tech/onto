import { describe, expect, it } from "vitest";
import { addInvariantPhrase, editActionPhrase } from "./sideLists";
import { blockingIssues, invariantViolations, validateOntology } from "./validate";
import { parseOntologyYaml, serializeOntology } from "./yaml";
import type { Action } from "../types";

const LEGACY_RULES_YAML = `domain: legacy
version: 1.0.0
notes: ""
entities: []
relationships: []
actions: []
rules:
  - id: rule-no-negative-stock
    statement: Stock never goes negative.
  - id: rule-one-active-visit
    statement: Client has at most one active visit.
open_questions: []
out_of_scope: []
`;

describe("legacy rules key", () => {
  it("opens a file written with `rules` as invariants, keeping order and text", () => {
    const doc = parseOntologyYaml(LEGACY_RULES_YAML);
    expect(doc.invariants).toEqual([
      { id: "rule-no-negative-stock", statement: "Stock never goes negative." },
      { id: "rule-one-active-visit", statement: "Client has at most one active visit." },
    ]);
    expect(blockingIssues(validateOntology(doc))).toEqual([]);
  });

  it("saves the new `invariants` key and does not drop anything on reopen", () => {
    const doc = parseOntologyYaml(LEGACY_RULES_YAML);
    const out = serializeOntology(doc);
    expect(out).toContain("invariants:");
    expect(out).not.toMatch(/^rules:/m);
    const again = parseOntologyYaml(out);
    expect(again.invariants).toEqual(doc.invariants);
  });

  it("prefers the new key when both are present", () => {
    const text = `${LEGACY_RULES_YAML}invariants:
  - id: invariant-new
    statement: New assertion.
`;
    const doc = parseOntologyYaml(text);
    expect(doc.invariants).toEqual([
      { id: "invariant-new", statement: "New assertion." },
    ]);
  });
});

describe("action rule", () => {
  it("round-trips through YAML next to its action", () => {
    const doc = parseOntologyYaml(LEGACY_RULES_YAML);
    doc.actions.push({
      id: "action_confirm",
      name: "Confirm",
      rule: "Only after payment is confirmed.",
    });
    const out = serializeOntology(doc);
    expect(out).toContain("rule: Only after payment is confirmed.");
    const again = parseOntologyYaml(out);
    expect(again.actions[0]).toEqual({
      id: "action_confirm",
      name: "Confirm",
      rule: "Only after payment is confirmed.",
    });
    expect(blockingIssues(validateOntology(again))).toEqual([]);
  });

  it("survives a rename of the action", () => {
    const current: Action = { id: "confirm", name: "Confirm", rule: "Paid only." };
    const renamed = editActionPhrase([current], "confirm", "Approve");
    expect(renamed[0]).toEqual({
      id: "action_approve",
      name: "Approve",
      rule: "Paid only.",
    });
  });
});

describe("invariant violations", () => {
  it("are reported on their own channel, not as schema errors", () => {
    const doc = parseOntologyYaml(LEGACY_RULES_YAML);
    doc.invariants = [
      { id: "invariant-stock", statement: "Stock never goes negative." },
      { id: "invariant-stock", statement: "Stock never goes negative." },
    ];
    const issues = validateOntology(doc);
    const violations = invariantViolations(issues);
    expect(violations.map((issue) => issue.code).sort()).toEqual([
      "duplicateInvariantId",
      "invariantDuplicateStatement",
    ]);
    expect(blockingIssues(issues)).toEqual([]);
  });

  it("keeps a clean document free of violations", () => {
    const doc = parseOntologyYaml(LEGACY_RULES_YAML);
    doc.invariants = addInvariantPhrase(doc.invariants, "Every order has a client.");
    expect(invariantViolations(validateOntology(doc))).toEqual([]);
  });

  it("round-trips invariant metadata (source, source_type, checked_at) cleanly", () => {
    const doc = parseOntologyYaml(LEGACY_RULES_YAML);
    doc.invariants = [
      {
        id: "inv_client_order",
        statement: "Clients cannot exceed 10 active orders",
        source: "https://wiki.corp/sales/rules#orders",
        source_type: "doc",
        checked_at: "2026-11-05",
      },
    ];
    const yaml = serializeOntology(doc);
    expect(yaml).toContain("source: https://wiki.corp/sales/rules#orders");
    expect(yaml).toContain("source_type: doc");
    expect(yaml).toContain("checked_at: 2026-11-05");

    const parsed = parseOntologyYaml(yaml);
    expect(parsed.invariants[0]).toEqual({
      id: "inv_client_order",
      statement: "Clients cannot exceed 10 active orders",
      source: "https://wiki.corp/sales/rules#orders",
      source_type: "doc",
      checked_at: "2026-11-05",
    });

    const issues = validateOntology(parsed);
    expect(blockingIssues(issues)).toEqual([]);
    expect(invariantViolations(issues)).toEqual([]);
  });
});
