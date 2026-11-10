import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import schema from "../../../schema/ontology.schema.json";
import { translate } from "../i18n";
import { formatValidationIssue } from "./validationMessages";
import { validateOntology, type ValidationIssue } from "./validate";
import { parseOntologyYaml, serializeOntology } from "./yaml";
import type { Action, Ontology } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, "../../../templates/generic.yaml");
const validateSchema = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

function docWithAction(action: Action): Ontology {
  const doc = parseOntologyYaml(readFileSync(templatePath, "utf8"));
  doc.layout = undefined;
  doc.entities = [
    {
      id: "entity_business_actions",
      name: "Business actions",
      primary_key: "action_id",
      attributes: [{ id: "action_id", type: "string", name: "Action id", required: true }],
    },
  ];
  doc.actions = [action];
  return doc;
}

function withLegacyStates(action: Action, fields: Record<string, unknown>): Action {
  return { ...action, ...fields } as unknown as Action;
}

function only(issues: ValidationIssue[], code: string): ValidationIssue {
  const found = issues.filter((issue) => issue.code === code);
  expect(found).toHaveLength(1);
  return found[0]!;
}

const plainAction: Action = {
  id: "submit-action-for-approval",
  name: "Submit action for approval",
  entity: "entity_business_actions",
  requires_confirmation: true,
  rule: "all fields are filled",
};

describe("actions without states", () => {
  it("loads, validates and round-trips a document without state fields", () => {
    const doc = docWithAction(plainAction);
    expect(validateOntology(doc)).toEqual([]);

    const text = serializeOntology(doc);
    expect(text).not.toContain("from_states");
    expect(text).not.toContain("to_state");

    const again = parseOntologyYaml(text);
    expect(again.actions).toEqual([plainAction]);
    expect(validateOntology(again)).toEqual([]);
  });

  it("does not require the action to be bound to an entity", () => {
    const doc = docWithAction({ id: "approve", name: "Approve" });
    expect(validateOntology(doc)).toEqual([]);
  });

  it("accepts an entity that has no status attribute", () => {
    const doc = docWithAction(plainAction);
    expect(doc.entities[0]!.attributes.some((a) => a.id === "status")).toBe(false);
    expect(validateOntology(doc)).toEqual([]);
  });
});

describe("legacy state fields", () => {
  it("is rejected by the JSON schema itself", () => {
    for (const field of ["from_states", "to_state"] as const) {
      const doc = docWithAction(
        withLegacyStates(plainAction, field === "from_states" ? { from_states: ["draft"] } : { to_state: "pending" }),
      );
      expect(validateSchema(doc), field).toBe(false);
      const unexpected = validateSchema.errors?.find(
        (error) =>
          error.keyword === "additionalProperties" &&
          (error.params as { additionalProperty?: string }).additionalProperty === field,
      );
      expect(unexpected, field).toBeDefined();
      expect(unexpected?.instancePath, field).toBe("/actions/0");
    }
  });

  it("reports from_states with one explanatory issue and no generic schema noise", () => {
    const doc = docWithAction(withLegacyStates(plainAction, { from_states: ["draft"] }));
    const issues = validateOntology(doc);

    expect(issues.some((issue) => issue.keyword === "additionalProperties")).toBe(false);
    const issue = only(issues, "actionStatesUnsupported");
    expect(issue.action).toBe("submit-action-for-approval");
    expect(issue.value).toBe("from_states");
  });

  it("rejects to_state the same way", () => {
    const doc = docWithAction(withLegacyStates(plainAction, { to_state: "pending" }));
    const issue = only(validateOntology(doc), "actionStatesUnsupported");
    expect(issue.value).toBe("to_state");
  });

  it("keeps parsed legacy fields so opening a legacy file is not silent", () => {
    const text = serializeOntology(docWithAction(plainAction)).replace(
      "  - id: submit-action-for-approval",
      "  - from_states:\n      - draft\n    id: submit-action-for-approval",
    );
    const doc = parseOntologyYaml(text);
    expect((doc.actions[0] as unknown as Record<string, unknown>).from_states).toEqual([
      "draft",
    ]);
    expect(only(validateOntology(doc), "actionStatesUnsupported").action).toBe(
      "submit-action-for-approval",
    );
  });

  it("does not re-serialize state fields", () => {
    const doc = docWithAction(withLegacyStates(plainAction, { from_states: ["draft"] }));
    const text = serializeOntology(doc);
    expect(text).not.toContain("from_states");
    expect(text).not.toContain("to_state");
  });
});

describe("action state message", () => {
  const doc = docWithAction(withLegacyStates(plainAction, { from_states: ["draft"] }));
  const issue = only(validateOntology(doc), "actionStatesUnsupported");

  const messages = {
    en: formatValidationIssue(issue, (key, vars) => translate("en", key, vars)),
    ru: formatValidationIssue(issue, (key, vars) => translate("ru", key, vars)),
    ko: formatValidationIssue(issue, (key, vars) => translate("ko", key, vars)),
  };

  it("says states are unsupported and names the fields to remove", () => {
    expect(messages.en).toContain("states are not supported");
    expect(messages.en).toContain("from_states/to_state");
    expect(messages.ru).toContain("состояния не поддерживаются");
    expect(messages.ru).toContain("from_states/to_state");
    expect(messages.ko).toContain("지원되지 않습니다");
    expect(messages.ko).toContain("from_states/to_state");
  });

  it("names the action and leaves no unsubstituted placeholders", () => {
    for (const [lang, message] of Object.entries(messages)) {
      expect(message, lang).toContain("submit-action-for-approval");
      expect(message, lang).not.toMatch(/\{\{/);
    }
  });
});

describe("cardinality validation", () => {
  const baseDoc: Ontology = {
    domain: "cardinality_test",
    version: "1.0.0",
    notes: "",
    entities: [
      { id: "user", name: "User", attributes: [] },
      { id: "post", name: "Post", attributes: [] },
    ],
    relationships: [],
    actions: [],
    invariants: [],
    open_questions: [],
    out_of_scope: [],
  };

  it("reports cardinalityFromMinGreaterThanMax when from_min > from_max", () => {
    const doc: Ontology = {
      ...baseDoc,
      relationships: [
        {
          id: "rel1",
          from: "user",
          to: "post",
          name: "authors",
          cardinality: { from: "2..1", to: "0..*" },
        },
      ],
    };
    const issues = validateOntology(doc);
    const issue = only(issues, "cardinalityFromMinGreaterThanMax");
    expect(issue.relationship).toBe("rel1");
    expect(issue.value).toBe("2..1");

    const msgEn = formatValidationIssue(issue, (k, v) => translate("en", k, v));
    expect(msgEn).toContain("source cardinality min is greater than max");
    expect(msgEn).not.toMatch(/\{\{/);
  });

  it("reports cardinalityToMinGreaterThanMax when to_min > to_max", () => {
    const doc: Ontology = {
      ...baseDoc,
      relationships: [
        {
          id: "rel1",
          from: "user",
          to: "post",
          name: "authors",
          cardinality: { from: "0..1", to: "5..2" },
        },
      ],
    };
    const issues = validateOntology(doc);
    const issue = only(issues, "cardinalityToMinGreaterThanMax");
    expect(issue.relationship).toBe("rel1");
    expect(issue.value).toBe("5..2");

    const msgRu = formatValidationIssue(issue, (k, v) => translate("ru", k, v));
    expect(msgRu).toContain("минимальная кардинальность цели больше максимальной");
    expect(msgRu).not.toMatch(/\{\{/);
  });

  it("reports cardinalityMaxExceeded when actual edges exceed max bound", () => {
    const doc: Ontology = {
      ...baseDoc,
      relationships: [
        {
          id: "rel1",
          from: "user",
          to: "post",
          name: "writes",
          cardinality: "0..1",
        },
        {
          id: "rel2",
          from: "user",
          to: "post",
          name: "writes",
          cardinality: "0..1",
        },
      ],
    };
    const issues = validateOntology(doc);
    const maxExceeded = issues.filter((i) => i.code === "cardinalityMaxExceeded");
    expect(maxExceeded.length).toBeGreaterThanOrEqual(1);

    const msgKo = formatValidationIssue(maxExceeded[0]!, (k, v) => translate("ko", k, v));
    expect(msgKo).toContain("최대 관계 수를 초과했습니다");
    expect(msgKo).not.toMatch(/\{\{/);
  });
});
