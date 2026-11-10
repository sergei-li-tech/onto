import type { Cardinality } from "../types";

export interface CardinalityPreset {
  label: string;
  min: string;
  max: string;
}

export const CARDINALITY_PRESETS: CardinalityPreset[] = [
  { label: "1..1", min: "1", max: "1" },
  { label: "0..1", min: "0", max: "1" },
  { label: "1..*", min: "1", max: "*" },
  { label: "0..*", min: "0", max: "*" },
];

export function normalizeBound(value: Cardinality | string): string {
  const trimmed = String(value).trim();
  if (trimmed === "many") return "*";
  return trimmed;
}

export function numericBound(value: Cardinality | string): number {
  const norm = normalizeBound(value);
  if (norm === "*") return Infinity;
  const n = Number(norm);
  return Number.isNaN(n) ? NaN : n;
}

export function isCardinalityBoundValid(value: string): boolean {
  const norm = normalizeBound(value);
  if (norm === "*") return true;
  return /^[0-9]+$/.test(norm);
}

export function isCardinalityRangeValid(min: string, max: string): boolean {
  if (!isCardinalityBoundValid(min) || !isCardinalityBoundValid(max)) return false;
  const numMin = numericBound(min);
  const numMax = numericBound(max);
  if (numMin < 0) return false;
  return numMin <= numMax;
}

export function parseCardinalityRange(rangeStr: string): { min: string; max: string } | null {
  const trimmed = rangeStr.trim();
  if (!trimmed) return null;
  if (trimmed.includes("..")) {
    const [partMin, partMax] = trimmed.split("..").map((s) => s.trim());
    if (partMin !== undefined && partMax !== undefined) {
      const min = normalizeBound(partMin);
      const max = normalizeBound(partMax);
      if (isCardinalityBoundValid(min) && isCardinalityBoundValid(max)) {
        return { min, max };
      }
    }
  } else {
    const single = normalizeBound(trimmed);
    if (isCardinalityBoundValid(single)) {
      return { min: single, max: single };
    }
  }
  return null;
}

/** Mark on edge end: 0..1, 1, 0..*, 1..*, 2..5 etc. */
export function formatCardinality(min: Cardinality, max: Cardinality): string {
  const from = normalizeBound(min);
  const to = normalizeBound(max);
  return from === to ? from : `${from}..${to}`;
}

export interface CardinalityBounds {
  from_min: string;
  from_max: string;
  to_min: string;
  to_max: string;
}

export type CardinalitySpec = string | { from?: string; to?: string };

/**
 * Parses a cardinality specification:
 * - "0..*" or "1..*" -> from: 1..1, to: 0..*
 * - "0..1 -> 0..*" -> from: 0..1, to: 0..*
 * - { from: "0..1", to: "1..*" } -> from: 0..1, to: 1..*
 */
export function parseCardinalitySpec(spec: unknown): CardinalityBounds | null {
  if (typeof spec === "string") {
    const trimmed = spec.trim();
    if (!trimmed) return null;
    if (trimmed.includes("->")) {
      const [left, right] = trimmed.split("->").map((s) => s.trim());
      const fromParsed = left ? parseCardinalityRange(left) : null;
      const toParsed = right ? parseCardinalityRange(right) : null;
      if (fromParsed && toParsed) {
        return {
          from_min: fromParsed.min,
          from_max: fromParsed.max,
          to_min: toParsed.min,
          to_max: toParsed.max,
        };
      }
    }
    const single = parseCardinalityRange(trimmed);
    if (single) {
      return {
        from_min: "1",
        from_max: "1",
        to_min: single.min,
        to_max: single.max,
      };
    }
    return null;
  }

  if (spec && typeof spec === "object") {
    const obj = spec as { from?: unknown; to?: unknown };
    const fromStr = typeof obj.from === "string" ? obj.from : "1";
    const toStr = typeof obj.to === "string" ? obj.to : "*";
    const fromParsed = parseCardinalityRange(fromStr);
    const toParsed = parseCardinalityRange(toStr);
    if (fromParsed && toParsed) {
      return {
        from_min: fromParsed.min,
        from_max: fromParsed.max,
        to_min: toParsed.min,
        to_max: toParsed.max,
      };
    }
  }

  return null;
}

/**
 * Formats bounds into compact cardinality for YAML:
 * - If from is 1..1 (standard): returns "0..*" or "1..*", etc.
 * - If from is not 1..1: returns { from: "0..1", to: "0..*" }
 */
export function formatCardinalitySpec(
  from_min: string,
  from_max: string,
  to_min: string,
  to_max: string,
): CardinalitySpec {
  const normFromMin = normalizeBound(from_min);
  const normFromMax = normalizeBound(from_max);
  const toFormatted = formatCardinality(to_min, to_max);

  if (normFromMin === "1" && normFromMax === "1") {
    return toFormatted;
  }

  const fromFormatted = formatCardinality(from_min, from_max);
  return {
    from: fromFormatted,
    to: toFormatted,
  };
}
