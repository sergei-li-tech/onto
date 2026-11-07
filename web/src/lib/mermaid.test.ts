import { describe, expect, it } from "vitest";
import type { Ontology } from "../types";
import {
  exportMermaid,
  exportMermaidER,
  exportMermaidFlowchart,
  exportMermaidStateDiagram,
} from "./mermaid";

const sampleDoc: Ontology = {
  domain: "shop",
  version: "1.0.0",
  notes: "Shop model",
  entities: [
    {
      id: "customer",
      name: "Customer",
      attributes: [
        { id: "id", name: "ID", type: "string", required: true },
        { id: "tier", name: "Tier", type: "enum", values: ["bronze", "silver", "gold"] },
      ],
    },
    {
      id: "order",
      name: "Order",
      attributes: [
        { id: "id", name: "ID", type: "string" },
        { id: "status", name: "Status", type: "enum", values: ["draft", "confirmed", "paid"] },
      ],
    },
  ],
  relationships: [
    {
      id: "rel-customer-order",
      from: "customer",
      to: "order",
      name: "places",
      from_min: "1",
      from_max: "1",
      to_min: "0",
      to_max: "many",
    },
  ],
  actions: [
    {
      id: "confirm_order",
      name: "Confirm Order",
      entity: "order",
    },
  ],
  invariants: [],
  open_questions: [],
  out_of_scope: [],
};

describe("Mermaid Export", () => {
  it("exports valid ER diagram syntax with fields and cardinality", () => {
    const er = exportMermaidER(sampleDoc);
    expect(er).toContain("erDiagram");
    expect(er).toContain("customer {");
    expect(er).toContain("string id");
    expect(er).toContain("enum tier");
    expect(er).toContain('customer ||--o{ order : "places"');
  });

  it("exports valid Flowchart TD syntax", () => {
    const flow = exportMermaidFlowchart(sampleDoc);
    expect(flow).toContain("flowchart TD");
    expect(flow).toContain('customer["Customer"]');
    expect(flow).toContain('order["Order"]');
    expect(flow).toContain('customer -->|"places"| order');
    expect(flow).toContain('act_confirm_order(["Confirm Order"])');
    expect(flow).toContain("order -.-> act_confirm_order");
  });

  it("exports valid State Diagram syntax with transitions", () => {
    const states = exportMermaidStateDiagram(sampleDoc);
    expect(states).toContain("stateDiagram-v2");
    expect(states).toContain('state "Order" as order_states {');
    expect(states).toContain("[*] --> draft");
    expect(states).toContain("draft --> confirmed : Confirm Order");
  });

  it("handles empty or minimal documents gracefully", () => {
    const minimal: Ontology = {
      domain: "empty",
      version: "1.0.0",
      notes: "",
      entities: [],
      relationships: [],
      actions: [],
      invariants: [],
      open_questions: [],
      out_of_scope: [],
    };
    expect(exportMermaid(minimal, "er")).toBe("erDiagram");
    expect(exportMermaid(minimal, "flowchart")).toBe("flowchart TD");
    expect(exportMermaid(minimal, "states")).toContain("stateDiagram-v2");
  });
});
