import { describe, expect, it } from "vitest";
import type { Ontology, TechnicalMapping } from "../types";
import {
  createDefaultTechnicalMapping,
  getEntityMappingCoverage,
  migrateMappingOnActionRemove,
  migrateMappingOnActionRename,
  migrateMappingOnAttributeRemove,
  migrateMappingOnAttributeRename,
  migrateMappingOnEntityRemove,
  migrateMappingOnEntityRename,
  parseTechnicalMappingYaml,
  serializeTechnicalMapping,
  validateTechnicalMapping,
} from "./technicalMapping";
import { useOntologyStore } from "../store";

const sampleDoc: Ontology = {
  domain: "bank",
  version: "1.0.0",
  notes: "Core banking domain",
  entities: [
    {
      id: "customer",
      name: "Customer",
      attributes: [
        { id: "id", name: "ID", type: "string", required: true },
        { id: "tax_id", name: "Tax ID", type: "string", pii: true },
      ],
    },
    {
      id: "account",
      name: "Account",
      attributes: [
        { id: "id", name: "ID", type: "string" },
        { id: "balance", name: "Balance", type: "decimal" },
      ],
    },
  ],
  relationships: [
    {
      id: "rel1",
      from: "customer",
      to: "account",
      name: "holds",
      cardinality: "1..*",
    },
  ],
  actions: [
    {
      id: "verify_compliance",
      name: "Verify Compliance",
      entity: "customer",
    },
  ],
  invariants: [],
  open_questions: [],
  out_of_scope: [],
};

describe("Technical Mapping Schema Validation & Round-trip", () => {
  it("creates a valid default technical mapping from ontology", () => {
    const mapping = createDefaultTechnicalMapping(sampleDoc);
    expect(mapping.binds_to).toBe("bank#1.0.0");
    expect(mapping.entity_mappings?.customer).toBeDefined();
    expect(mapping.action_mappings?.verify_compliance).toBeDefined();

    const issues = validateTechnicalMapping(mapping, sampleDoc);
    expect(issues).toEqual([]);
  });

  it("round-trips through YAML serialization", () => {
    const mapping: TechnicalMapping = {
      version: "1.0.0",
      binds_to: "bank#1.0.0",
      infrastructure: {
        data_sources: {
          primary_postgres: {
            type: "postgresql",
            dsn_env_var: "DATABASE_URL",
          },
        },
        mcp_connectors: [
          { name: "compliance_tool", url: "mcp://compliance:8080" },
        ],
      },
      entity_mappings: {
        customer: {
          system_of_record: "primary_postgres",
          table: "tbl_clients",
          field_mappings: {
            id: "client_id",
            tax_id: "vat_number",
          },
        },
      },
      action_mappings: {
        verify_compliance: {
          handler: "services.compliance.run",
          mcp_connector: "compliance_tool",
          telemetry_sink: "postgresql://logs/traces",
        },
      },
    };

    const yaml = serializeTechnicalMapping(mapping);
    expect(yaml).toContain("binds_to: bank#1.0.0");
    expect(yaml).toContain("tbl_clients");
    expect(yaml).toContain("compliance_tool");

    const parsed = parseTechnicalMappingYaml(yaml);
    expect(parsed.entity_mappings?.customer?.table).toBe("tbl_clients");
    expect(parsed.action_mappings?.verify_compliance?.mcp_connector).toBe("compliance_tool");

    const issues = validateTechnicalMapping(parsed, sampleDoc);
    expect(issues).toEqual([]);
  });

  it("reports validation error for invalid data source type in schema", () => {
    const invalidMapping = {
      version: "1.0.0",
      binds_to: "bank#1.0.0",
      infrastructure: {
        data_sources: {
          db: { type: "unknown_db_type" as never },
        },
      },
    };
    const issues = validateTechnicalMapping(invalidMapping);
    expect(issues.some((i) => i.code === "schema" && i.keyword === "enum")).toBe(true);
  });
});

describe("Technical Mapping Cross-Validation against Business Ontology", () => {
  it("reports unknown entity in entity_mappings", () => {
    const mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.entity_mappings!["ghost_entity"] = { table: "tbl_ghost" };

    const issues = validateTechnicalMapping(mapping, sampleDoc);
    expect(issues.some((i) => i.code === "mappingUnknownEntity" && i.entity === "ghost_entity")).toBe(true);
  });

  it("reports unknown attribute in field_mappings", () => {
    const mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.entity_mappings!.customer!.field_mappings!["non_existent_field"] = "col_x";

    const issues = validateTechnicalMapping(mapping, sampleDoc);
    expect(issues.some((i) => i.code === "mappingUnknownAttribute" && i.attribute === "non_existent_field")).toBe(true);
  });

  it("reports unknown action in action_mappings", () => {
    const mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.action_mappings!["ghost_action"] = { handler: "run" };

    const issues = validateTechnicalMapping(mapping, sampleDoc);
    expect(issues.some((i) => i.code === "mappingUnknownAction" && i.action === "ghost_action")).toBe(true);
  });

  it("reports unknown data source and unknown mcp connector", () => {
    const mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.entity_mappings!.customer!.system_of_record = "unconfigured_source";
    mapping.action_mappings!.verify_compliance!.mcp_connector = "unconfigured_mcp";

    const issues = validateTechnicalMapping(mapping, sampleDoc);
    expect(issues.some((i) => i.code === "mappingUnknownDataSource")).toBe(true);
    expect(issues.some((i) => i.code === "mappingUnknownMcpConnector")).toBe(true);
  });
});

describe("Coverage Calculation", () => {
  it("calculates unmapped, partial, and complete status", () => {
    const entity = sampleDoc.entities[0]!; // 2 attributes

    // Unmapped
    expect(getEntityMappingCoverage(entity, undefined).status).toBe("unmapped");
    expect(getEntityMappingCoverage(entity, { table: "" }).status).toBe("unmapped");

    // Partial
    expect(
      getEntityMappingCoverage(entity, {
        table: "tbl_clients",
        field_mappings: { id: "client_id" },
      }).status,
    ).toBe("partial");

    // Complete
    expect(
      getEntityMappingCoverage(entity, {
        table: "tbl_clients",
        field_mappings: { id: "client_id", tax_id: "vat" },
      }).status,
    ).toBe("complete");
  });
});

describe("Automatic Migrations on Rename / Delete", () => {
  it("migrates entity_mappings on entity rename and delete", () => {
    let mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.entity_mappings!.customer!.table = "tbl_cust";

    // Rename
    mapping = migrateMappingOnEntityRename(mapping, "customer", "client");
    expect(mapping.entity_mappings!["customer"]).toBeUndefined();
    expect(mapping.entity_mappings!["client"]?.table).toBe("tbl_cust");

    // Remove
    mapping = migrateMappingOnEntityRemove(mapping, "client");
    expect(mapping.entity_mappings!["client"]).toBeUndefined();
  });

  it("migrates field_mappings on attribute rename and delete", () => {
    let mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.entity_mappings!.customer!.field_mappings = { tax_id: "vat_code" };

    // Rename attribute
    mapping = migrateMappingOnAttributeRename(mapping, "customer", "tax_id", "vat_identifier");
    expect(mapping.entity_mappings!.customer!.field_mappings!["tax_id"]).toBeUndefined();
    expect(mapping.entity_mappings!.customer!.field_mappings!["vat_identifier"]).toBe("vat_code");

    // Remove attribute
    mapping = migrateMappingOnAttributeRemove(mapping, "customer", "vat_identifier");
    expect(mapping.entity_mappings!.customer!.field_mappings!["vat_identifier"]).toBeUndefined();
  });

  it("migrates action_mappings on action rename and delete", () => {
    let mapping = createDefaultTechnicalMapping(sampleDoc);
    mapping.action_mappings!.verify_compliance!.handler = "run_check";

    // Rename action
    mapping = migrateMappingOnActionRename(mapping, "verify_compliance", "check_client");
    expect(mapping.action_mappings!["verify_compliance"]).toBeUndefined();
    expect(mapping.action_mappings!["check_client"]?.handler).toBe("run_check");

    // Remove action
    mapping = migrateMappingOnActionRemove(mapping, "check_client");
    expect(mapping.action_mappings!["check_client"]).toBeUndefined();
  });
});

describe("Store Dual-Mode Integration", () => {
  it("initializes technical mapping when switching to technical mode", () => {
    useOntologyStore.getState().loadDocument(sampleDoc, null, "bank.yaml");
    expect(useOntologyStore.getState().viewMode).toBe("business");
    expect(useOntologyStore.getState().mappingDoc).toBeNull();

    // Switch to technical
    useOntologyStore.getState().setViewMode("technical");
    expect(useOntologyStore.getState().viewMode).toBe("technical");
    expect(useOntologyStore.getState().mappingDoc).not.toBeNull();
    expect(useOntologyStore.getState().mappingDoc?.binds_to).toBe("bank#1.0.0");
  });

  it("automatically migrates mappingDoc keys when business entity is renamed in store", () => {
    useOntologyStore.getState().loadDocument(sampleDoc, null, "bank.yaml");
    useOntologyStore.getState().setViewMode("technical");
    useOntologyStore.getState().updateEntityMapping("customer", { table: "tbl_clients" });

    // Switch back to business mode on client call
    useOntologyStore.getState().setViewMode("business");
    // Client says: "Let's call Customer 'Client'"
    useOntologyStore.getState().renameEntityName("customer", "Client");

    // Check that mapping preserved the table under new id
    const newEntityId = useOntologyStore.getState().doc?.entities.find((e) => e.name === "Client")?.id;
    expect(newEntityId).toBeDefined();
    const mapping = useOntologyStore.getState().mappingDoc!;
    expect(mapping.entity_mappings!["customer"]).toBeUndefined();
    expect(mapping.entity_mappings![newEntityId!]?.table).toBe("tbl_clients");
  });
});
