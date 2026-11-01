import { describe, expect, it } from "vitest";
import { formatCommaList, parseCommaList } from "./commaList";

describe("parseCommaList", () => {
  it("keeps a phrase with spaces as one item", () => {
    expect(parseCommaList("new client")).toEqual(["new client"]);
  });

  it("splits only on commas and trims each item", () => {
    expect(parseCommaList(" lead , new client , ")).toEqual(["lead", "new client"]);
  });

  it("drops empty pieces", () => {
    expect(parseCommaList(" , , ")).toEqual([]);
  });
});

describe("formatCommaList", () => {
  it("joins items with a comma and a space", () => {
    expect(formatCommaList(["lead", "new client"])).toBe("lead, new client");
  });
});
