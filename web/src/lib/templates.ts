import type { Ontology, TemplateId } from "../types";
import { cloneOntology, parseOntologyYaml } from "./yaml";

import genericRaw from "../../../templates/generic.yaml?raw";

export const TEMPLATE_ID: TemplateId = "generic";

export const TEMPLATE_LABEL = "Generic business";

export function loadTemplate(): Ontology {
  return parseOntologyYaml(genericRaw);
}

export function copyFromTemplate(clientDomain: string): Ontology {
  const src = loadTemplate();
  const copy = cloneOntology(src);
  copy.domain = clientDomain.trim() || "default";
  copy.based_on = { id: src.domain, version: src.version };
  copy.updated_at = new Date().toISOString();
  delete copy.author;
  return copy;
}
