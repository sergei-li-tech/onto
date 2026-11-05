import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import { formatValidationIssue } from "./validationMessages";
import { validateOntology, type ValidationIssue } from "./validate";
import { parseOntologyYaml, serializeOntology } from "./yaml";
import type { Ontology } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, "../../../templates/generic.yaml");

function businessActionsDoc(options: {
  statusValues?: string[];
  fromStates?: string[];
  toState?: string;
  withEntity?: boolean;
}): Ontology {
  const doc = parseOntologyYaml(readFileSync(templatePath, "utf8"));
  doc.layout = undefined;
  doc.entities = [
    {
      id: "entity_business_actions",
      name: "Business actions",
      primary_key: "action_id",
      attributes: [
        { id: "action_id", type: "string", name: "Action id", required: true },
        ...(options.statusValues
          ? [
              {
                id: "status",
                type: "enum" as const,
                name: "Status",
                values: options.statusValues,
              },
            ]
          : []),
      ],
    },
  ];
  doc.actions = [
    {
      id: "submit-action-for-approval",
      name: "Submit action for approval",
      ...(options.withEntity === false ? {} : { entity: "entity_business_actions" }),
      ...(options.fromStates ? { from_states: options.fromStates } : {}),
      ...(options.toState ? { to_state: options.toState } : {}),
    },
  ];
  return doc;
}

function only(issues: ValidationIssue[], code: string): ValidationIssue {
  const found = issues.filter((issue) => issue.code === code);
  expect(found).toHaveLength(1);
  return found[0]!;
}

describe("action state checking", () => {
  it("does not require status when the action declares no states", () => {
    const doc = businessActionsDoc({});
    expect(validateOntology(doc)).toEqual([]);

    const again = parseOntologyYaml(serializeOntology(doc));
    expect(again.actions[0]?.entity).toBe("entity_business_actions");
    expect(validateOntology(again)).toEqual([]);
  });

  it("does not require status when from_states is empty", () => {
    const doc = businessActionsDoc({ fromStates: [] });
    // An empty from_states is rejected by the schema, but not as a missing status.
    expect(validateOntology(doc).map((issue) => issue.code)).not.toContain(
      "actionEntityNoStatus",
    );
    doc.actions[0]!.from_states = undefined;
    expect(validateOntology(doc)).toEqual([]);
  });

  it("reports a missing status enum when the action declares states", () => {
    const doc = businessActionsDoc({ fromStates: ["draft"], toState: "pending" });
    const issues = validateOntology(doc);
    const issue = only(issues, "actionEntityNoStatus");
    expect(issue.action).toBe("submit-action-for-approval");
    expect(issue.value).toBe("entity_business_actions");
    expect(issue.states).toBe("draft, pending");
  });

  it("keeps accepting an entity whose status enum covers the states", () => {
    const doc = businessActionsDoc({
      statusValues: ["draft", "pending"],
      fromStates: ["draft"],
      toState: "pending",
    });
    expect(validateOntology(doc)).toEqual([]);
  });

  it("reports an unknown target state against the enum", () => {
    const doc = businessActionsDoc({
      statusValues: ["draft", "pending"],
      fromStates: ["draft"],
      toState: "shipped",
    });
    const issue = only(validateOntology(doc), "actionUnknownToState");
    expect(issue.value).toBe("shipped");
  });
});

describe("action state message", () => {
  const doc = businessActionsDoc({ fromStates: ["draft"], toState: "pending" });
  const issue = only(validateOntology(doc), "actionEntityNoStatus");

  const messages = {
    en: formatValidationIssue(issue, (key, vars) => translate("en", key, vars)),
    ru: formatValidationIssue(issue, (key, vars) => translate("ru", key, vars)),
    ko: formatValidationIssue(issue, (key, vars) => translate("ko", key, vars)),
  };

  it("names the entity, the states and the attribute to add", () => {
    for (const [lang, message] of Object.entries(messages)) {
      expect(message, lang).toContain("entity_business_actions");
      expect(message, lang).toContain("draft, pending");
      expect(message, lang).toContain("status");
      expect(message, lang).toContain("enum");
    }
  });

  it("offers the alternative of removing the states", () => {
    expect(messages.en).toContain("remove from_states/to_state");
    expect(messages.ru).toContain("уберите from_states/to_state");
    expect(messages.ko).toContain("from_states/to_state");
  });

  it("leaves no unsubstituted placeholders", () => {
    for (const [lang, message] of Object.entries(messages)) {
      expect(message, lang).not.toMatch(/\{\{/);
    }
  });
});

describe("schema condition on action states", () => {
  it("requires entity when the action declares states", () => {
    const doc = businessActionsDoc({
      fromStates: ["draft"],
      toState: "pending",
      withEntity: false,
    });
    const issues = validateOntology(doc).filter((issue) => issue.code === "schema");
    const missing = issues.find(
      (issue) => issue.keyword === "required" && issue.field === "entity",
    );
    expect(missing).toBeDefined();
    expect(missing?.path).toBe("/actions/0");
  });

  it("accepts an action without states and without entity", () => {
    const doc = businessActionsDoc({ withEntity: false });
    expect(validateOntology(doc)).toEqual([]);
  });
});
