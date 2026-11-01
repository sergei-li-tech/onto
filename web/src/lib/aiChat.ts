import type { Ontology } from "../types";
import type { OntologyOperation } from "./applyOperations";
import type { DraftTurn } from "./draftHandoff";

export type ChatScope = "global" | "entity" | "relationship" | "draft";

export type ChatResponse = {
  assistant_message: string;
  operations: OntologyOperation[];
  brief?: string;
};

export async function sendOntologyChat(
  message: string,
  ontology: Ontology,
  scope: ChatScope,
  selectedEntityId: string | null,
  history: DraftTurn[] = [],
  selectedRelationshipId: string | null = null,
): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    message,
    ontology,
    scope,
    selected_entity_id: selectedEntityId,
    selected_relationship_id: selectedRelationshipId,
  };
  if (scope === "draft") body.history = history;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }

  return (await res.json()) as ChatResponse;
}

export async function checkAiHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}
