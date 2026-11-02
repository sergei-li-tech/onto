import { describe, expect, it } from "vitest";
import { LANGS } from "../i18n";
import { LANG_CODES, langCode, stepIndex } from "./langMenu";

describe("language menu helpers", () => {
  it("has a short code for every language", () => {
    for (const item of LANGS) {
      expect(langCode(item.id)).toMatch(/^[A-Z]{2}$/);
      expect(LANG_CODES[item.id]).toBe(langCode(item.id));
    }
  });

  it("wraps arrow-key navigation in both directions", () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(1, -1, 3)).toBe(0);
  });

  it("stays on the only item of a single-entry menu", () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, -1, 1)).toBe(0);
  });

  it("handles an empty menu", () => {
    expect(stepIndex(0, 1, 0)).toBe(-1);
  });
});
