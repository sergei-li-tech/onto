export type Cardinality = string;

export type AttributeType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "ref";

export interface Attribute {
  id: string;
  type: AttributeType;
  name: string;
  required?: boolean;
  pii?: boolean;
  values?: string[];
  entity?: string;
}

export interface Entity {
  id: string;
  name: string;
  template_name?: string;
  aliases?: string[];
  /** Meta: optional business identifier of an instance (not a field code in attributes). */
  unique_identifier?: string;
  notes?: string;
  primary_key?: string;
  attributes: Attribute[];
}

export type CardinalitySpec = string | { from?: string; to?: string };

export interface Relationship {
  id: string;
  from: string;
  to: string;
  name: string;
  cardinality: CardinalitySpec;
  notes?: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ActionInput {
  name: string;
  type: AttributeType;
  required?: boolean;
  description?: string;
  values?: string[];
  entity?: string;
}

export interface Action {
  id: string;
  name: string;
  entity?: string;
  produces?: string;
  requires_confirmation?: boolean;
  /** OAO risk assessment for Tool Interceptor / execution gating. */
  risk_level?: RiskLevel;
  /** Roles authorized to invoke this action (RBAC). */
  roles_allowed?: string[];
  /** Human-in-the-loop warning message displayed when confirmation is required. */
  warning_prompt?: string;
  /** Local execution condition: the action is blocked until it holds. Free text, no DSL. */
  rule?: string;
  /** Structured typed input parameters for tool calling / AI agent execution. */
  inputs?: ActionInput[];
}

export type InvariantSourceType = "doc" | "call" | "legal" | "system" | "other";

/** Always-true assertion checked after any action (formerly `rules`). */
export interface Invariant {
  id: string;
  statement: string;
  source?: string;
  source_type?: InvariantSourceType;
  checked_at?: string;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface Layout {
  nodes?: LayoutNode[];
}

export interface BasedOn {
  id: string;
  version: string;
}

export interface Ontology {
  domain: string;
  version: string;
  based_on?: BasedOn;
  updated_at?: string;
  author?: string;
  notes: string;
  entities: Entity[];
  relationships: Relationship[];
  actions: Action[];
  invariants: Invariant[];
  open_questions: string[];
  out_of_scope: string[];
  layout?: Layout;
}

export type Selection =
  | { kind: "entity"; id: string }
  | { kind: "relationship"; id: string }
  | { kind: "action"; id: string }
  | { kind: "invariant"; id: string }
  | null;

export type TemplateId = "generic";

export type DataSourceType = "postgresql" | "snowflake" | "openapi_v3" | "rest" | "custom";

export interface DataSource {
  type: DataSourceType;
  dsn_env_var?: string;
  warehouse?: string;
  endpoint?: string;
}

export interface McpConnector {
  name: string;
  url: string;
}

export interface EntityMapping {
  system_of_record?: string;
  table?: string;
  field_mappings?: Record<string, string>;
}

export interface ActionMapping {
  handler?: string;
  mcp_connector?: string;
  telemetry_sink?: string;
}

export interface TechnicalMappingInfrastructure {
  data_sources?: Record<string, DataSource>;
  mcp_connectors?: McpConnector[];
}

export interface TechnicalMapping {
  $schema?: string;
  version: string;
  binds_to: string;
  infrastructure?: TechnicalMappingInfrastructure;
  entity_mappings?: Record<string, EntityMapping>;
  action_mappings?: Record<string, ActionMapping>;
}

export type ViewMode = "business" | "technical";

