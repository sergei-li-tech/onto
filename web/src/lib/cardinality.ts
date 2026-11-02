import type { Cardinality } from "../types";

function mark(value: Cardinality): string {
  return value === "many" ? "*" : value;
}

/** Mark on edge end: 0..1, 1, 0..*. */
export function formatCardinality(min: Cardinality, max: Cardinality): string {
  const from = mark(min);
  const to = mark(max);
  return from === to ? from : `${from}..${to}`;
}
