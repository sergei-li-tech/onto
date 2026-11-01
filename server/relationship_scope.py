"""Scope filter for the relationship assistant."""

from __future__ import annotations

from typing import Any

CARDINALITY = {"0", "1", "many"}

RELATIONSHIP_SCOPE_PROMPT = """You are an assistant for a single relationship during a discussion with a domain stakeholder.

Scope is strict: only the selected_relationship_id relationship.
Only one operation is allowed: update_relationship with this id.
Allowed in patch: name and cardinality from_min, from_max, to_min, to_max.
name — in English, how they are related.
from_min and from_max — how many from entities per one to entity.
to_min and to_max — how many to entities per one from entity.
Cardinality values are only "0", "1", or "many".
0 for minimum means the relationship is optional on that side.

You cannot change from and to. You cannot create or remove entities or other relationships.
If asked to edit entities or other relationships — set operations: [] and explain that this is handled by the schema assistant.

Respond ONLY with JSON (no markdown):
{
  "assistant_message": "brief reply in English",
  "operations": [ ... ]
}

Format: {"op":"update_relationship","id":"...","patch":{"name?","from_min?","from_max?","to_min?","to_max?"}}"""


def relationship_context(doc: dict[str, Any], relationship_id: str) -> dict[str, Any]:
    relationships = doc.get("relationships") or []
    if not isinstance(relationships, list):
        relationships = []
    target = next(
        (
            item
            for item in relationships
            if isinstance(item, dict) and item.get("id") == relationship_id
        ),
        None,
    )
    entities = doc.get("entities") or []
    if not isinstance(entities, list):
        entities = []

    def end(entity_id: object) -> dict[str, Any] | None:
        if not isinstance(entity_id, str):
            return None
        found = next(
            (
                item
                for item in entities
                if isinstance(item, dict) and item.get("id") == entity_id
            ),
            None,
        )
        if not isinstance(found, dict):
            return {"id": entity_id}
        return {"id": found.get("id"), "name": found.get("name")}

    from_id = target.get("from") if isinstance(target, dict) else None
    to_id = target.get("to") if isinstance(target, dict) else None
    return {
        "relationship": target,
        "from_entity": end(from_id),
        "to_entity": end(to_id),
    }


def scope_relationship_operations(
    operations: list[Any], relationship_id: str
) -> list[dict[str, Any]]:
    scoped: list[dict[str, Any]] = []
    for op in operations:
        trimmed = _trim_relationship_op(op, relationship_id)
        if trimmed is not None:
            scoped.append(trimmed)
    return scoped


def _trim_relationship_op(op: Any, relationship_id: str) -> dict[str, Any] | None:
    if not isinstance(op, dict) or op.get("op") != "update_relationship":
        return None
    if op.get("id") != relationship_id:
        return None
    patch = op.get("patch")
    if not isinstance(patch, dict):
        return None
    next_patch: dict[str, str] = {}
    name = patch.get("name")
    if isinstance(name, str) and name.strip():
        next_patch["name"] = name
    for key in ("from_min", "from_max", "to_min", "to_max"):
        value = patch.get(key)
        if isinstance(value, str) and value in CARDINALITY:
            next_patch[key] = value
    if not next_patch:
        return None
    return {"op": "update_relationship", "id": relationship_id, "patch": next_patch}
