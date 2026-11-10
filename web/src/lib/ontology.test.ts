import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyBusinessDisplayName,
  renameEntityDisplayName,
  renameEntityInDocument,
} from "./entityNames";
import { addActionPhrase } from "./sideLists";
import { copyFromTemplate } from "./templates";
import { validateOntology } from "./validate";
import { ONTOLOGY_SCHEMA_URL, parseOntologyYaml, serializeOntology } from "./yaml";

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(here, "../../../templates");

const templateFiles = ["generic.yaml"];

describe("templates", () => {
  for (const file of templateFiles) {
    it(`validates ${file}`, () => {
      const text = readFileSync(join(templatesDir, file), "utf8");
      const doc = parseOntologyYaml(text);
      const errors = validateOntology(doc);
      expect(errors).toEqual([]);
      expect(doc.notes).toBe("");
    });
  }
});

describe("yaml round-trip", () => {
  it("round-trips entity unique_identifier", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.entities[0]!.unique_identifier = "CRM-42";
    const again = parseOntologyYaml(serializeOntology(doc));
    expect(again.entities[0]?.unique_identifier).toBe("CRM-42");
    expect(validateOntology(again)).toEqual([]);
  });

  it("keeps stable top-level key order", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    const out = serializeOntology(doc);
    const lines = out.split("\n").filter((l) => l && !l.startsWith(" "));
    expect(lines[0]).toBe(`$schema: ${ONTOLOGY_SCHEMA_URL}`);
    expect(lines[1]).toBe("domain: default");
    expect(lines[2]).toBe("version: 1.0.0");
    expect(out).toContain("notes:");
    expect(out.indexOf("entities:")).toBeLessThan(out.indexOf("layout:"));
  });

  it("points $schema at the published schema with a literal raw URL", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    expect(ONTOLOGY_SCHEMA_URL).toBe(
      "https://raw.githubusercontent.com/sergei-li-tech/onto/main/schema/ontology.schema.json",
    );
    const out = serializeOntology(doc);
    expect(out.split("\n")[0]).toBe(
      `$schema: https://raw.githubusercontent.com/sergei-li-tech/onto/main/schema/ontology.schema.json`,
    );
    expect(validateOntology(parseOntologyYaml(out))).toEqual([]);
  });
});

describe("name-only action", () => {
  it("stays valid and round-trips", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.actions = addActionPhrase(doc.actions, "Confirm order");
    expect(validateOntology(doc)).toEqual([]);
    const again = parseOntologyYaml(serializeOntology(doc));
    expect(again.actions).toEqual([
      { id: "action_confirm_order", name: "Confirm order" },
    ]);
  });
});

describe("copyFromTemplate", () => {
  it("stamps based_on from template", () => {
    const doc = copyFromTemplate("salon-test");
    expect(doc.domain).toBe("salon-test");
    expect(doc.based_on).toEqual({ id: "default", version: "1.0.0" });
  });

  it("uses default when the domain field is empty", () => {
    expect(copyFromTemplate("  ").domain).toBe("default");
  });
});

describe("display name", () => {
  it("preserves id and sets template_name on business rename", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    const client = doc.entities.find((e) => e.id === "client")!;
    const next = applyBusinessDisplayName(client, "Lead");
    expect(next.id).toBe("client");
    expect(next.name).toBe("Lead");
    expect(next.template_name).toBe("Client");
    expect(next.aliases).toContain("Client");
  });

  it("rename on blur keeps template_name without alias spam", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    const client = doc.entities.find((e) => e.id === "client")!;
    const renamed = renameEntityDisplayName(client, "Buyer");
    expect(renamed.name).toBe("Buyer");
    expect(renamed.template_name).toBe("Client");
    expect(renamed.aliases ?? []).not.toContain("Buyer");
  });

  it("regenerates the entity id from the new name and keeps links", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.entities.push({
      id: "visit",
      name: "Visit",
      primary_key: "id",
      attributes: [
        { id: "id", type: "string", name: "Identifier.", required: true },
        { id: "client_ref", type: "ref", name: "Client.", entity: "client" },
      ],
    });
    doc.relationships.push({
      id: "visit_client",
      from: "visit",
      to: "client",
      name: "for",
      cardinality: { from: "0..*", to: "1" },
    });
    doc.layout = { nodes: [{ id: "client", x: 10, y: 20 }] };

    const next = renameEntityInDocument(doc, "client", "Scout", "display");
    expect(next.id).toBe("entity_scout");
    const renamed = next.doc.entities.find((e) => e.name === "Scout");
    expect(renamed?.id).toBe("entity_scout");
    expect(renamed?.template_name).toBe("Client");
    expect(next.doc.relationships[0]?.to).toBe("entity_scout");
    expect(next.doc.entities.find((e) => e.id === "visit")?.attributes[1]?.entity).toBe(
      "entity_scout",
    );
    expect(next.doc.layout?.nodes?.[0]?.id).toBe("entity_scout");
    expect(validateOntology(next.doc)).toEqual([]);
  });

  it("regenerates the id for a business name and keeps the template word", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    const next = renameEntityInDocument(doc, "client", "Lead", "business");
    expect(next.id).toBe("entity_lead");
    expect(next.doc.entities[0]?.template_name).toBe("Client");
    expect(next.doc.entities[0]?.aliases).toContain("Client");
  });

  it("adds a suffix when the generated id is already taken", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.entities.push({
      id: "entity_scout",
      name: "Other",
      primary_key: "id",
      attributes: [{ id: "id", type: "string", name: "Identifier.", required: true }],
    });
    const next = renameEntityInDocument(doc, "client", "Scout", "display");
    expect(next.id).toBe("entity_scout_2");
  });

  it("leaves the id when the name does not change", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    const next = renameEntityInDocument(doc, "client", "Client", "display");
    expect(next.id).toBe("client");
    expect(next.doc).toBe(doc);
  });
});

describe("schema rejection", () => {
  it("flags broken relationship reference", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.relationships.push({
      id: "bad-link",
      from: "missing",
      to: "client",
      name: "test",
      cardinality: "0..*",
    });
    const errors = validateOntology(doc);
    expect(
      errors.some(
        (e) => e.code === "relationshipUnknownFrom" && e.value === "missing",
      ),
    ).toBe(true);
  });

  it("serializes and parses compact cardinality in YAML", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.entities.push({
      id: "order",
      name: "Order",
      attributes: [],
    });
    doc.relationships.push({
      id: "places",
      from: "client",
      to: "order",
      name: "places",
      cardinality: "0..*",
    });

    const yaml = serializeOntology(doc);
    expect(yaml).toContain("cardinality: 0..*");
    expect(yaml).not.toContain("from_min");
    expect(yaml).not.toContain("from_max");
    expect(yaml).not.toContain("to_min");
    expect(yaml).not.toContain("to_max");

    const reloaded = parseOntologyYaml(yaml);
    expect(reloaded.relationships).toHaveLength(1);
    expect(reloaded.relationships[0]?.cardinality).toBe("0..*");
    expect(validateOntology(reloaded)).toEqual([]);
  });

  it("supports bidirectional cardinality objects in YAML", () => {
    const text = readFileSync(join(templatesDir, "generic.yaml"), "utf8");
    const doc = parseOntologyYaml(text);
    doc.entities.push({
      id: "department",
      name: "Department",
      attributes: [],
    });
    doc.relationships.push({
      id: "belongs_to",
      from: "client",
      to: "department",
      name: "belongs_to",
      cardinality: { from: "0..1", to: "1..*" },
    });

    const yaml = serializeOntology(doc);
    expect(yaml).toContain("cardinality:\n");
    expect(yaml).toContain("from: 0..1");
    expect(yaml).toContain("to: 1..*");

    const reloaded = parseOntologyYaml(yaml);
    expect(reloaded.relationships[0]?.cardinality).toEqual({ from: "0..1", to: "1..*" });
    expect(validateOntology(reloaded)).toEqual([]);
  });
});
