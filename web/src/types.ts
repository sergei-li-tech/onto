export type Cardinality = "0" | "1" | "many";

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

export interface Relationship {
  id: string;
  from: string;
  to: string;
  name: string;
  from_min: Cardinality;
  from_max: Cardinality;
  to_min: Cardinality;
  to_max: Cardinality;
  notes?: string;
}

export interface Action {
  id: string;
  name: string;
  entity?: string;
  from_states?: string[];
  to_state?: string;
  requires_confirmation?: boolean;
}

export interface Rule {
  id: string;
  statement: string;
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
  rules: Rule[];
  open_questions: string[];
  out_of_scope: string[];
  layout?: Layout;
}

export type Selection =
  | { kind: "entity"; id: string }
  | { kind: "relationship"; id: string }
  | { kind: "action"; id: string }
  | { kind: "rule"; id: string }
  | null;

export type TemplateId = "generic";
