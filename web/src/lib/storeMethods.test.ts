import { beforeEach, describe, expect, it } from "vitest";
import type { Ontology } from "../types";
import { useOntologyStore } from "../store";

const initialDoc: Ontology = {
  domain: "test-domain",
  version: "1.0.0",
  notes: "Test notes",
  entities: [
    {
      id: "customer",
      name: "Customer",
      attributes: [{ id: "name", name: "Name", type: "string" }],
    },
    {
      id: "order",
      name: "Order",
      attributes: [{ id: "total", name: "Total", type: "decimal" }],
    },
  ],
  relationships: [
    {
      id: "customer-places-order",
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
      id: "pay",
      name: "Pay",
      entity: "order",
    },
  ],
  invariants: [
    {
      id: "order_must_have_customer",
      statement: "Every order must belong to a customer",
    },
  ],
  open_questions: [],
  out_of_scope: [],
  layout: {
    nodes: [
      { id: "customer", x: 10, y: 20 },
      { id: "order", x: 100, y: 200 },
    ],
  },
};

describe("Ontology Store Extended Operations", () => {
  beforeEach(() => {
    useOntologyStore.getState().loadDocument(initialDoc, null, "test.yaml");
  });

  it("duplicates an entity with its attributes and layout offset", () => {
    const store = useOntologyStore.getState();
    store.duplicateEntity("customer");

    const updated = useOntologyStore.getState().doc!;
    expect(updated.entities).toHaveLength(3);
    const duplicate = updated.entities.find((e) => e.name === "Customer Copy");
    expect(duplicate).toBeDefined();
    expect(duplicate?.attributes).toHaveLength(1);
    expect(duplicate?.attributes[0].name).toBe("Name");

    const dupNode = updated.layout?.nodes?.find((n) => n.id === duplicate?.id);
    expect(dupNode).toBeDefined();
    expect(dupNode?.x).toBe(50);
    expect(dupNode?.y).toBe(60);

    expect(useOntologyStore.getState().selection).toEqual({
      kind: "entity",
      id: duplicate?.id,
    });
  });

  it("removes an entity and its connected relationships, actions, and layout", () => {
    const store = useOntologyStore.getState();
    store.setSelection({ kind: "entity", id: "order" });
    store.removeEntity("order");

    const updated = useOntologyStore.getState().doc!;
    expect(updated.entities.map((e) => e.id)).toEqual(["customer"]);
    expect(updated.relationships).toHaveLength(0);
    expect(updated.actions).toHaveLength(0);
    expect(updated.layout?.nodes?.map((n) => n.id)).toEqual(["customer"]);
    expect(useOntologyStore.getState().selection).toBeNull();
  });

  it("adds and removes actions", () => {
    const store = useOntologyStore.getState();
    store.addAction("Ship Order", "order");

    let updated = useOntologyStore.getState().doc!;
    expect(updated.actions).toHaveLength(2);
    const added = updated.actions.find((a) => a.name === "Ship Order");
    expect(added?.entity).toBe("order");

    store.setSelection({ kind: "action", id: added!.id });
    store.removeAction(added!.id);

    updated = useOntologyStore.getState().doc!;
    expect(updated.actions).toHaveLength(1);
    expect(useOntologyStore.getState().selection).toBeNull();
  });

  it("removes invariant and clears selection", () => {
    const store = useOntologyStore.getState();
    store.setSelection({ kind: "invariant", id: "order_must_have_customer" });
    store.removeInvariant("order_must_have_customer");

    const updated = useOntologyStore.getState().doc!;
    expect(updated.invariants).toHaveLength(0);
    expect(useOntologyStore.getState().selection).toBeNull();
  });
});

