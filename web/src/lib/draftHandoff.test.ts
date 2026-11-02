import { describe, expect, it } from "vitest";
import { composeSchemaInput, draftHistory, takeDraftReply } from "./draftHandoff";

describe("takeDraftReply", () => {
  it("drops operations and trims the brief", () => {
    expect(
      takeDraftReply({
        assistant_message: "Clarify duration.",
        brief: "  Add entity Appointment. Fields: start.  ",
        operations: [{ op: "add_entity" }],
      }),
    ).toEqual({
      text: "Clarify duration.",
      brief: "Add entity Appointment. Fields: start.",
    });
  });

  it("treats a missing brief as empty", () => {
    expect(takeDraftReply({ assistant_message: "What is this about?", operations: [] })).toEqual({
      text: "What is this about?",
      brief: "",
    });
  });
});

describe("draftHistory", () => {
  it("pairs each user line with the following reply", () => {
    expect(
      draftHistory([
        { role: "user", text: "appointment with specialist" },
        { role: "assistant", text: "How long does it take?", brief: "  Add entity Appointment.  " },
      ]),
    ).toEqual([
      {
        user: "appointment with specialist",
        assistant: "How long does it take?",
        brief: "Add entity Appointment.",
      },
    ]);
  });

  it("drops a user line that has no reply yet", () => {
    expect(
      draftHistory([
        { role: "user", text: "appointment" },
        { role: "assistant", text: "Which service?", brief: "" },
        { role: "user", text: "manicure" },
      ]),
    ).toEqual([{ user: "appointment", assistant: "Which service?", brief: "" }]);
  });

  it("keeps only the last six turns", () => {
    const lines = Array.from({ length: 8 }, (_, i) => [
      { role: "user" as const, text: `note ${i}` },
      { role: "assistant" as const, text: `question ${i}`, brief: `brief ${i}` },
    ]).flat();
    const history = draftHistory(lines);
    expect(history.map((turn) => turn.user)).toEqual(
      ["2", "3", "4", "5", "6", "7"].map((i) => `note ${i}`),
    );
  });

  it("treats a missing brief as empty", () => {
    expect(
      draftHistory([
        { role: "user", text: "  appointment  " },
        { role: "assistant", text: "  Clarify  " },
      ]),
    ).toEqual([{ user: "appointment", assistant: "Clarify", brief: "" }]);
  });
});

describe("composeSchemaInput", () => {
  it("fills an empty schema field with the brief", () => {
    expect(composeSchemaInput("", "Add entity Appointment. Fields: start.")).toBe(
      "Add entity Appointment. Fields: start.",
    );
  });

  it("appends the brief under text already in the schema field", () => {
    expect(composeSchemaInput("Add entity Service.", "Add entity Appointment. Fields: start.")).toBe(
      "Add entity Service.\nAdd entity Appointment. Fields: start.",
    );
  });

  it("leaves the schema field unchanged when the brief is blank", () => {
    expect(composeSchemaInput("Add entity Service.", "  ")).toBe("Add entity Service.");
  });
});
