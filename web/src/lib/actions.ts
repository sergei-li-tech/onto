import type { Ontology } from "../types";
import { snakeIdFromText } from "./ids";

/** Action id from name: action_confirm. */
export function actionIdFromName(name: string, taken: string[]): string {
  const base = snakeIdFromText(name, "action");
  let id = base;
  let suffix = 2;
  while (taken.includes(id)) {
    id = `${base.slice(0, 58)}_${suffix}`.slice(0, 64);
    suffix += 1;
  }
  return id;
}

/** New action name sets its id. */
export function renameActionInDocument(
  doc: Ontology,
  actionId: string,
  newName: string,
): { doc: Ontology; id: string } {
  const action = doc.actions.find((item) => item.id === actionId);
  if (!action) return { doc, id: actionId };
  const trimmed = newName.trim();
  if (!trimmed || trimmed === action.name) return { doc, id: actionId };

  const newId = actionIdFromName(
    trimmed,
    doc.actions.filter((item) => item.id !== actionId).map((item) => item.id),
  );
  return {
    id: newId,
    doc: {
      ...doc,
      actions: doc.actions.map((item) =>
        item.id === actionId ? { ...item, id: newId, name: trimmed } : item,
      ),
    },
  };
}
