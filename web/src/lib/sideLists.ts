import type { Action, Rule } from "../types";
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

export function ruleIdFromStatement(statement: string, taken: string[]): string {
  const base = slugIdFromText(statement, "rule");
  let id = base;
  let suffix = 2;
  while (taken.includes(id)) {
    id = `${base.slice(0, 60)}-${suffix}`.slice(0, 64);
    suffix += 1;
  }
  return id;
}

export function addRulePhrase(rules: Rule[], phrase: string): Rule[] {
  const statement = phrase.trim();
  if (!statement) return rules;
  const id = ruleIdFromStatement(
    statement,
    rules.map((rule) => rule.id),
  );
  return [...rules, { id, statement }];
}

export function editRulePhrase(rules: Rule[], id: string, phrase: string): Rule[] {
  const statement = phrase.trim();
  const current = rules.find((rule) => rule.id === id);
  if (!current || !statement || statement === current.statement) return rules;
  const nextId = ruleIdFromStatement(
    statement,
    rules.filter((rule) => rule.id !== id).map((rule) => rule.id),
  );
  return rules.map((rule) => (rule.id === id ? { id: nextId, statement } : rule));
}

export function removeRule(rules: Rule[], id: string): Rule[] {
  return rules.filter((rule) => rule.id !== id);
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
