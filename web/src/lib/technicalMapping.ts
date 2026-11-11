import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Document, YAMLMap, parse } from "yaml";
import mappingSchema from "../../../schema/technical_mapping.schema.json";
import type {
  ActionMapping,
  Entity,
  EntityMapping,
  Ontology,
  TechnicalMapping,
} from "../types";
import type { ValidationIssue } from "./validate";

export const TECHNICAL_MAPPING_SCHEMA_URL =
  "https://raw.githubusercontent.com/sergei-li-tech/onto/main/schema/technical_mapping.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(mappingSchema);

const TOP_LEVEL_ORDER = [
  "$schema",
  "version",
  "binds_to",
  "infrastructure",
  "entity_mappings",
  "action_mappings",
] as const;

function orderedMap(obj: Record<string, unknown>): YAMLMap {
  const map = new YAMLMap();
  for (const key of TOP_LEVEL_ORDER) {
    if (key in obj && obj[key] !== undefined) {
      map.set(key, obj[key]);
    }
  }
  return map;
}

export function createDefaultTechnicalMapping(doc: Ontology): TechnicalMapping {
  const entity_mappings: Record<string, EntityMapping> = {};
  for (const entity of doc.entities) {
    const field_mappings: Record<string, string> = {};
    for (const attr of entity.attributes) {
      field_mappings[attr.id] = "";
    }
    entity_mappings[entity.id] = {
      system_of_record: "",
      table: "",
      field_mappings,
    };
  }

  const action_mappings: Record<string, ActionMapping> = {};
  for (const action of doc.actions) {
    action_mappings[action.id] = {
      handler: "",
      mcp_connector: "",
      telemetry_sink: "",
    };
  }

  return {
    $schema: TECHNICAL_MAPPING_SCHEMA_URL,
    version: "1.0.0",
    binds_to: `${doc.domain}#${doc.version}`,
    infrastructure: {
      data_sources: {
        primary_db: {
          type: "postgresql",
          dsn_env_var: "DATABASE_URL",
        },
      },
      mcp_connectors: [],
    },
    entity_mappings,
    action_mappings,
  };
}

export function serializeTechnicalMapping(mapping: TechnicalMapping): string {
  const plain: Record<string, unknown> = {
    $schema: TECHNICAL_MAPPING_SCHEMA_URL,
    version: mapping.version || "1.0.0",
    binds_to: mapping.binds_to,
  };

  if (mapping.infrastructure) {
    plain.infrastructure = mapping.infrastructure;
  }
  if (mapping.entity_mappings && Object.keys(mapping.entity_mappings).length > 0) {
    plain.entity_mappings = mapping.entity_mappings;
  }
  if (mapping.action_mappings && Object.keys(mapping.action_mappings).length > 0) {
    plain.action_mappings = mapping.action_mappings;
  }

  const yamlDoc = new Document(orderedMap(plain));
  yamlDoc.options.lineWidth = 0;
  return yamlDoc.toString();
}

export function parseTechnicalMappingYaml(text: string): TechnicalMapping {
  const raw = parse(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid Technical Mapping YAML: root must be an object");
  }
  return raw as TechnicalMapping;
}

export function validateTechnicalMapping(
  mapping: TechnicalMapping,
  doc?: Ontology,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  const ok = validateSchema(mapping);
  if (!ok && validateSchema.errors) {
    for (const e of validateSchema.errors) {
      const params = (e.params ?? {}) as Record<string, unknown>;
      const field =
        typeof params.missingProperty === "string"
          ? params.missingProperty
          : typeof params.additionalProperty === "string"
            ? params.additionalProperty
            : undefined;
      errors.push({
        code: "schema",
        keyword: e.keyword,
        path: e.instancePath || "/",
        field,
        type: typeof params.type === "string" ? params.type : undefined,
      });
    }
  }

  if (doc) {
    const expectedBind = `${doc.domain}#${doc.version}`;
    if (mapping.binds_to && mapping.binds_to !== expectedBind && !mapping.binds_to.startsWith(`${doc.domain}#`)) {
      errors.push({
        code: "mappingBindsToMismatch",
        value: mapping.binds_to,
      });
    }

    const docEntityMap = new Map<string, Entity>(doc.entities.map((e) => [e.id, e]));
    const docActionIds = new Set(doc.actions.map((a) => a.id));
    const knownDataSources = new Set(
      mapping.infrastructure?.data_sources ? Object.keys(mapping.infrastructure.data_sources) : [],
    );
    const knownMcpConnectors = new Set(
      mapping.infrastructure?.mcp_connectors?.map((c) => c.name) ?? [],
    );

    if (mapping.entity_mappings) {
      for (const [entityId, entMap] of Object.entries(mapping.entity_mappings)) {
        const entity = docEntityMap.get(entityId);
        if (!entity) {
          errors.push({
            code: "mappingUnknownEntity",
            entity: entityId,
            value: entityId,
          });
          continue;
        }

        if (entMap.system_of_record && !knownDataSources.has(entMap.system_of_record)) {
          errors.push({
            code: "mappingUnknownDataSource",
            entity: entityId,
            value: entMap.system_of_record,
          });
        }

        if (entMap.field_mappings) {
          const attrIds = new Set(entity.attributes.map((a) => a.id));
          for (const attrId of Object.keys(entMap.field_mappings)) {
            if (!attrIds.has(attrId)) {
              errors.push({
                code: "mappingUnknownAttribute",
                entity: entityId,
                attribute: attrId,
                value: attrId,
              });
            }
          }
        }
      }
    }

    if (mapping.action_mappings) {
      for (const [actionId, actMap] of Object.entries(mapping.action_mappings)) {
        if (!docActionIds.has(actionId)) {
          errors.push({
            code: "mappingUnknownAction",
            action: actionId,
            value: actionId,
          });
          continue;
        }

        if (actMap.mcp_connector && !knownMcpConnectors.has(actMap.mcp_connector)) {
          errors.push({
            code: "mappingUnknownMcpConnector",
            action: actionId,
            value: actMap.mcp_connector,
          });
        }
      }
    }
  }

  return errors;
}

export function getEntityMappingCoverage(
  entity: Entity,
  mapping?: EntityMapping,
): { total: number; mapped: number; status: "complete" | "partial" | "unmapped" } {
  const total = entity.attributes.length;
  if (!mapping || !mapping.table?.trim()) {
    return { total, mapped: 0, status: "unmapped" };
  }
  const fieldMappings = mapping.field_mappings || {};
  let mapped = 0;
  for (const attr of entity.attributes) {
    if (fieldMappings[attr.id]?.trim()) {
      mapped++;
    }
  }
  if (mapped === 0) return { total, mapped: 0, status: total === 0 ? "complete" : "unmapped" };
  if (mapped >= total) return { total, mapped, status: "complete" };
  return { total, mapped, status: "partial" };
}

export function migrateMappingOnEntityRename(
  mapping: TechnicalMapping,
  oldEntityId: string,
  newEntityId: string,
): TechnicalMapping {
  if (oldEntityId === newEntityId || !mapping.entity_mappings) return mapping;
  const entity_mappings: Record<string, EntityMapping> = {};
  for (const [id, value] of Object.entries(mapping.entity_mappings)) {
    if (id === oldEntityId) {
      entity_mappings[newEntityId] = value;
    } else {
      entity_mappings[id] = value;
    }
  }
  return { ...mapping, entity_mappings };
}

export function migrateMappingOnEntityRemove(
  mapping: TechnicalMapping,
  entityId: string,
): TechnicalMapping {
  if (!mapping.entity_mappings || !(entityId in mapping.entity_mappings)) return mapping;
  const { [entityId]: _, ...rest } = mapping.entity_mappings;
  return { ...mapping, entity_mappings: rest };
}

export function migrateMappingOnAttributeRename(
  mapping: TechnicalMapping,
  entityId: string,
  oldAttrId: string,
  newAttrId: string,
): TechnicalMapping {
  if (oldAttrId === newAttrId || !mapping.entity_mappings?.[entityId]?.field_mappings) {
    return mapping;
  }
  const entMap = mapping.entity_mappings[entityId]!;
  const currentFields = entMap.field_mappings ?? {};
  if (!(oldAttrId in currentFields)) return mapping;

  const nextFields: Record<string, string> = {};
  for (const [id, val] of Object.entries(currentFields)) {
    if (id === oldAttrId) {
      nextFields[newAttrId] = val;
    } else {
      nextFields[id] = val;
    }
  }

  return {
    ...mapping,
    entity_mappings: {
      ...mapping.entity_mappings,
      [entityId]: {
        ...entMap,
        field_mappings: nextFields,
      },
    },
  };
}

export function migrateMappingOnAttributeRemove(
  mapping: TechnicalMapping,
  entityId: string,
  attrId: string,
): TechnicalMapping {
  if (!mapping.entity_mappings?.[entityId]?.field_mappings) return mapping;
  const entMap = mapping.entity_mappings[entityId]!;
  const currentFields = entMap.field_mappings ?? {};
  if (!(attrId in currentFields)) return mapping;

  const { [attrId]: _, ...restFields } = currentFields;
  return {
    ...mapping,
    entity_mappings: {
      ...mapping.entity_mappings,
      [entityId]: {
        ...entMap,
        field_mappings: restFields,
      },
    },
  };
}

export function migrateMappingOnActionRename(
  mapping: TechnicalMapping,
  oldActionId: string,
  newActionId: string,
): TechnicalMapping {
  if (oldActionId === newActionId || !mapping.action_mappings) return mapping;
  const action_mappings: Record<string, ActionMapping> = {};
  for (const [id, value] of Object.entries(mapping.action_mappings)) {
    if (id === oldActionId) {
      action_mappings[newActionId] = value;
    } else {
      action_mappings[id] = value;
    }
  }
  return { ...mapping, action_mappings };
}

export function migrateMappingOnActionRemove(
  mapping: TechnicalMapping,
  actionId: string,
): TechnicalMapping {
  if (!mapping.action_mappings || !(actionId in mapping.action_mappings)) return mapping;
  const { [actionId]: _, ...rest } = mapping.action_mappings;
  return { ...mapping, action_mappings: rest };
}

