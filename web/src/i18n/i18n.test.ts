import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ru } from "./ru";
import { ko } from "./ko";
import { translate } from "./index";

const enDict = en as Record<string, string>;
const ruDict = ru as Record<string, string>;
const koDict = ko as Record<string, string>;

describe("i18n dictionaries", () => {
  it("keeps the same key set in every language", () => {
    const keys = Object.keys(enDict).sort();
    expect(Object.keys(ruDict).sort()).toEqual(keys);
    expect(Object.keys(koDict).sort()).toEqual(keys);
  });

  it("has no empty values", () => {
    for (const [lang, dict] of Object.entries({ en: enDict, ru: ruDict, ko: koDict })) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${lang}:${key}`).not.toBe("");
      }
    }
  });

  it("defaults to English and interpolates values", () => {
    expect(translate("en", "topbar.save")).toBe("Save");
    expect(translate("en", "detail.selectedEntity", { name: "Client" })).toBe(
      "Selected: Client",
    );
    expect(translate("ru", "detail.selectedEntity", { name: "Client" })).toBe(
      "Выбрано: Client",
    );
    expect(translate("ko", "sidebar.notesSummaryCount", { count: 3 })).toBe(
      "메모 요약 (3)",
    );
  });

  it("translates every navigation label in ru and ko", () => {
    const keys = [
      "topbar.save",
      "topbar.saveAs",
      "topbar.undo",
      "topbar.redo",
      "topbar.autoLayout",
      "sidebar.entities",
      "detail.deleteEntity",
      "detail.noRelationships",
      "attributes.fields",
      "attributes.type",
      "ai.send",
      "ai.pendingChanges",
      "confirm.leave",
      "file.chromeOpen",
    ];
    for (const key of keys) {
      expect(ruDict[key], `ru:${key}`).not.toBe(enDict[key]);
      expect(koDict[key], `ko:${key}`).not.toBe(enDict[key]);
    }
  });
});
