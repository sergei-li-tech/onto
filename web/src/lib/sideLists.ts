import type { Action, Invariant } from "../types";
import { actionIdFromName } from "./actions";
import { slugIdFromText } from "./ids";

export function addPhrase(items: string[], phrase: string): string[] {
  const text = phrase.trim();
  if (!text) return items;
  return [...items, text];
}

export function editPhrase(items: string[], index: number, phrase: string): string[] {
  const text = phrase.trim();
  const current = items[index];
  if (current === undefined || !text || text === current) return items;
  return items.map((item, i) => (i === index ? text : item));
}

export function removePhrase(items: string[], index: number): string[] {
  return items.filter((_, i) => i !== index);
}

export function invariantIdFromStatement(statement: string, taken: string[]): string {
  const base = slugIdFromText(statement, "invariant");
  let id = base;
  let suffix = 2;
  while (taken.includes(id)) {
    id = `${base.slice(0, 60)}-${suffix}`.slice(0, 64);
    suffix += 1;
  }
  return id;
}

export function addInvariantPhrase(invariants: Invariant[], phrase: string): Invariant[] {
  const statement = phrase.trim();
  if (!statement) return invariants;
  const id = invariantIdFromStatement(
    statement,
    invariants.map((item) => item.id),
  );
  return [...invariants, { id, statement }];
}

export function editInvariantPhrase(
  invariants: Invariant[],
  id: string,
  phrase: string,
): Invariant[] {
  const statement = phrase.trim();
  const current = invariants.find((item) => item.id === id);
  if (!current || !statement || statement === current.statement) return invariants;
  const nextId = invariantIdFromStatement(
    statement,
    invariants.filter((item) => item.id !== id).map((item) => item.id),
  );
  return invariants.map((item) =>
    item.id === id ? { id: nextId, statement } : item,
  );
}

export function removeInvariant(invariants: Invariant[], id: string): Invariant[] {
  return invariants.filter((item) => item.id !== id);
}

export function addActionPhrase(actions: Action[], phrase: string): Action[] {
  const name = phrase.trim();
  if (!name) return actions;
  const id = actionIdFromName(
    name,
    actions.map((action) => action.id),
  );
  return [...actions, { id, name }];
}

export function editActionPhrase(actions: Action[], id: string, phrase: string): Action[] {
  const name = phrase.trim();
  const current = actions.find((action) => action.id === id);
  if (!current || !name || name === current.name) return actions;
  const nextId = actionIdFromName(
    name,
    actions.filter((action) => action.id !== id).map((action) => action.id),
  );
  return actions.map((action) =>
    action.id === id ? { ...action, id: nextId, name } : action,
  );
}

export function removeAction(actions: Action[], id: string): Action[] {
  return actions.filter((action) => action.id !== id);
}

/** Set or clear the local execution rule of an action. */
export function setActionRule(actions: Action[], id: string, rule: string): Action[] {
  const text = rule.trim();
  return actions.map((action) => {
    if (action.id !== id) return action;
    const next = { ...action };
    if (text) next.rule = text;
    else delete next.rule;
    return next;
  });
}
