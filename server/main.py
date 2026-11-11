"""
FastAPI proxy for ontology chat assistant.

Run from repo root:
  uv run uvicorn onto.server.main:app --reload --port 8790
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel, Field

from onto.server.config import LLM_API_BASE, LLM_CHAT_MODEL
from onto.server.credentials import resolve_llm_api_key
from onto.server.draft import DRAFT_SYSTEM_PROMPT, draft_history, normalize_draft_reply
from onto.server.relationship_scope import (
    RELATIONSHIP_SCOPE_PROMPT,
    relationship_context,
    scope_relationship_operations,
)

app = FastAPI(title="onto assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are an assistant during a call with a business stakeholder. You edit an ontology (YAML).

Rules:
- Entity and attribute ids — latin, snake_case: client, order, status.
- name — in English, for entity, relationship, attribute, and action. id is derived from name.
- Do not change layout, domain, version, based_on unless explicitly asked.
- Attribute types: string, integer, decimal, boolean, date, datetime, enum, ref.
- enum: values field (array of strings). ref: entity field (id of another entity).
- primary_key of entity — id of one of its attributes (if attributes is not empty). Do not set primary_key without attributes.
- add_entity: attributes only for fields explicitly named in the request; empty attributes is allowed. Do not invent fields. If a field is named — use the user's words in attribute name; attribute id is derived from name.

Respond ONLY with JSON (no markdown):
{
  "assistant_message": "brief reply in the interface language explaining changes or clarifying questions",
  "operations": [ ... ]
}

Allowed operations:
- {"op":"add_entity","entity":{"id","name","attributes":[],"aliases":[]}}
  Add elements to attributes only for fields explicitly named in the request.
- {"op":"update_entity","id":"...","patch":{"name?","aliases?","template_name?","unique_identifier?"}}
- {"op":"remove_entity","id":"..."}
- {"op":"add_attribute","entity_id":"...","attribute":{"id","type","name","required?","pii?","values?","entity?"}}
- {"op":"update_attribute","entity_id":"...","attribute_id":"...","patch":{"name?","type?","required?","pii?","values?","entity?"}}
- {"op":"remove_attribute","entity_id":"...","attribute_id":"..."}
- {"op":"add_relationship","relationship":{"id","from","to","name","cardinality"}}
  (cardinality: "0..*", "1..*", "0..1", "1..1", or {"from":"0..1","to":"0..*"})
- {"op":"update_relationship","id":"...","patch":{"name?"}}

If the request is unclear — set operations: [] and ask a question in assistant_message."""

ENTITY_SCOPE_PROMPT = """You are an assistant for a single entity during a call with a business stakeholder.

Scope is strict: only the selected_entity_id entity.
Allowed:
- update_entity only with this id (name, aliases, template_name)
- add_attribute, update_attribute, remove_attribute only with entity_id of this entity
- add_relationship, if from or to equals this id and the other end already exists in other_entity_names
- update_relationship only for relationships belonging to this entity

Not allowed: add_entity, remove_entity, modifying other entities or unrelated relationships.
If asked to create or modify another entity — set operations: [] and explain that this is handled by the schema assistant.

Respond ONLY with JSON (no markdown):
{
  "assistant_message": "brief reply in the interface language",
  "operations": [ ... ]
}

Operations format is the same as for schema assistant. Attribute types: string, integer, decimal, boolean, date, datetime, enum, ref."""


LANGUAGE_NAMES = {"en": "English", "ru": "Russian", "ko": "Korean"}

UI_TEXT = {
    "en": {
        "done": "Done.",
        "more_details": "More details needed.",
        "unrequested": "Properties not mentioned in the request were not added.",
        "entity_scope": (
            "Changes to other entities were discarded. "
            "Use schema assistant for cross-entity edits."
        ),
        "relationship_scope": (
            "Changes to other relationships were discarded. "
            "Use schema assistant for cross-relationship edits."
        ),
    },
    "ru": {
        "done": "Готово.",
        "more_details": "Нужны уточнения.",
        "unrequested": "Свойства, не упомянутые в запросе, не добавлены.",
        "entity_scope": (
            "Изменения других сущностей отброшены. "
            "Для правок нескольких сущностей используйте ассистента схемы."
        ),
        "relationship_scope": (
            "Изменения других связей отброшены. "
            "Для правок нескольких связей используйте ассистента схемы."
        ),
    },
    "ko": {
        "done": "완료했습니다.",
        "more_details": "추가 설명이 필요합니다.",
        "unrequested": "요청에 없는 속성은 추가하지 않았습니다.",
        "entity_scope": (
            "다른 엔터티의 변경은 버렸습니다. "
            "여러 엔터티를 수정하려면 스키마 어시스턴트를 사용하세요."
        ),
        "relationship_scope": (
            "다른 관계의 변경은 버렸습니다. "
            "여러 관계를 수정하려면 스키마 어시스턴트를 사용하세요."
        ),
    },
}


def _ui_text(lang: str) -> dict[str, str]:
    return UI_TEXT.get(lang, UI_TEXT["en"])


def _language_instruction(lang: str, *, include_brief: bool = False) -> str:
    name = LANGUAGE_NAMES.get(lang, LANGUAGE_NAMES["en"])
    target = "assistant_message and brief" if include_brief else "assistant_message"
    return (
        f"\n\nInterface language: {name}. Write {target} in {name}."
        " Entity, attribute, and relationship names and ids stay in English (latin):"
        " they are data, not interface text."
    )


class DraftTurn(BaseModel):
    user: str = ""
    assistant: str = ""
    brief: str = ""


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    ontology: dict[str, Any]
    scope: str = "global"
    selected_entity_id: str | None = None
    selected_relationship_id: str | None = None
    history: list[DraftTurn] = Field(default_factory=list)
    lang: str = "en"


class ChatResponse(BaseModel):
    assistant_message: str
    operations: list[dict[str, Any]]
    brief: str = ""


def _compact_ontology(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "domain": doc.get("domain"),
        "notes": doc.get("notes"),
        "entities": doc.get("entities", []),
        "relationships": doc.get("relationships", []),
        "invariants": doc.get("invariants", doc.get("rules", [])),
        "open_questions": doc.get("open_questions", []),
    }


def _entity_context(doc: dict[str, Any], entity_id: str) -> dict[str, Any]:
    entities = doc.get("entities") or []
    if not isinstance(entities, list):
        entities = []
    target = next(
        (e for e in entities if isinstance(e, dict) and e.get("id") == entity_id), None
    )
    others = [
        {"id": e.get("id"), "name": e.get("name")}
        for e in entities
        if isinstance(e, dict) and e.get("id") != entity_id
    ]
    relationships = doc.get("relationships") or []
    if not isinstance(relationships, list):
        relationships = []
    own_links = [
        r
        for r in relationships
        if isinstance(r, dict)
        and (r.get("from") == entity_id or r.get("to") == entity_id)
    ]
    return {
        "entity": target,
        "other_entity_names": others,
        "relationships": own_links,
    }


def _in_entity_scope(op: dict[str, Any], entity_id: str, own_rel_ids: set[str]) -> bool:
    kind = op.get("op")
    if kind == "update_entity":
        return op.get("id") == entity_id
    if kind in {"add_attribute", "update_attribute", "remove_attribute"}:
        return op.get("entity_id") == entity_id
    if kind == "add_relationship":
        rel = op.get("relationship")
        if not isinstance(rel, dict):
            return False
        return rel.get("from") == entity_id or rel.get("to") == entity_id
    if kind == "update_relationship":
        return op.get("id") in own_rel_ids
    return False


_BOILERPLATE = {
    "unique",
    "identifier",
    "description",
    "required",
    "value",
    "string",
    "field",
    "fields",
    "attribute",
    "attributes",
    "property",
    "entity",
    "entities",
    "object",
    "objects",
}


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9_]{3,}", text.lower())


def _attribute_named(
    message: str, entity_name: str, entity_id: str, attr: dict[str, Any]
) -> bool:
    message_tokens = set(_tokens(message))
    skip = set(_tokens(entity_name)) | set(_tokens(entity_id.replace("_", " ")))
    attr_id = str(attr.get("id") or "").lower()
    if (
        attr_id
        and attr_id != "id"
        and (attr_id in message_tokens or attr_id in message.lower())
    ):
        return True
    named = _tokens(str(attr.get("name") or ""))
    values = attr.get("values") or []
    if isinstance(values, list):
        for value in values:
            if isinstance(value, str):
                named.extend(_tokens(value))
    return any(
        tok not in _BOILERPLATE and tok not in skip and tok in message_tokens
        for tok in named
    )


def _prune_unrequested_attributes(message: str, operations: list[Any]) -> list[Any]:
    created_ids = {
        op.get("entity", {}).get("id")
        for op in operations
        if isinstance(op, dict)
        and op.get("op") == "add_entity"
        and isinstance(op.get("entity"), dict)
        and isinstance(op.get("entity", {}).get("id"), str)
    }
    kept_ops: list[Any] = []
    for op in operations:
        if not isinstance(op, dict):
            kept_ops.append(op)
            continue
        if op.get("op") == "add_entity" and isinstance(op.get("entity"), dict):
            entity = dict(op["entity"])
            name = str(entity.get("name") or "")
            entity_id = str(entity.get("id") or "")
            attributes = entity.get("attributes") or []
            if not isinstance(attributes, list):
                attributes = []
            kept_attrs = [
                attr
                for attr in attributes
                if isinstance(attr, dict)
                and (
                    str(attr.get("id") or "").lower() == "id"
                    or _attribute_named(message, name, entity_id, attr)
                )
            ]
            entity["attributes"] = kept_attrs
            primary = entity.get("primary_key")
            if not any(
                isinstance(attr, dict) and attr.get("id") == primary
                for attr in kept_attrs
            ):
                if any(
                    isinstance(attr, dict) and attr.get("id") == "id"
                    for attr in kept_attrs
                ):
                    entity["primary_key"] = "id"
                else:
                    entity.pop("primary_key", None)
            kept_ops.append({**op, "entity": entity})
            continue
        if (
            op.get("op") == "add_attribute"
            and op.get("entity_id") in created_ids
            and isinstance(op.get("attribute"), dict)
        ):
            attr = op["attribute"]
            if str(attr.get("id") or "").lower() == "id" or _attribute_named(
                message, "", str(op.get("entity_id") or ""), attr
            ):
                kept_ops.append(op)
            continue
        kept_ops.append(op)
    return kept_ops


def _parse_model_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Model response must be a JSON object")
    return data


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    try:
        api_key = resolve_llm_api_key()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"API key unavailable: {exc}. Set LLM_API_KEY or GCP ADC.",
        ) from exc

    model = os.environ.get("LLM_MODEL", LLM_CHAT_MODEL)
    client = OpenAI(api_key=api_key, base_url=LLM_API_BASE or None)

    entity_scope = body.scope == "entity"
    relationship_scope = body.scope == "relationship"
    draft_scope = body.scope == "draft"
    lang = body.lang if body.lang in LANGUAGE_NAMES else "en"
    texts = _ui_text(lang)
    if entity_scope and not body.selected_entity_id:
        raise HTTPException(
            status_code=400, detail="selected_entity_id is required for entity assistant."
        )
    if relationship_scope and not body.selected_relationship_id:
        raise HTTPException(
            status_code=400,
            detail="selected_relationship_id is required for relationship assistant.",
        )

    if draft_scope:
        context = _compact_ontology(body.ontology)
        system_prompt = DRAFT_SYSTEM_PROMPT + _language_instruction(
            lang, include_brief=True
        )
        scope_name = "draft"
    elif entity_scope:
        context = _entity_context(body.ontology, body.selected_entity_id or "")
        system_prompt = ENTITY_SCOPE_PROMPT + _language_instruction(lang)
        scope_name = "entity"
    elif relationship_scope:
        context = relationship_context(
            body.ontology, body.selected_relationship_id or ""
        )
        system_prompt = RELATIONSHIP_SCOPE_PROMPT + _language_instruction(lang)
        scope_name = "relationship"
    else:
        context = _compact_ontology(body.ontology)
        system_prompt = SYSTEM_PROMPT + _language_instruction(lang)
        scope_name = "global"

    user_payload = {
        "scope": scope_name,
        "selected_entity_id": body.selected_entity_id,
        "selected_relationship_id": body.selected_relationship_id,
        "ontology": context,
        "user_message": body.message,
        "lang": lang,
    }
    if draft_scope:
        user_payload["history"] = draft_history(
            [turn.model_dump() for turn in body.history]
        )

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(user_payload, ensure_ascii=False),
                },
            ],
            temperature=0.4 if draft_scope else 0.2,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"API error: {exc}") from exc

    raw = completion.choices[0].message.content or "{}"
    try:
        parsed = _parse_model_json(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail=f"Model returned invalid JSON: {exc}"
        ) from exc

    if draft_scope:
        normalized = normalize_draft_reply(parsed, texts["more_details"])
        return ChatResponse(
            assistant_message=normalized["assistant_message"],
            operations=[],
            brief=normalized["brief"],
        )

    assistant_message = str(parsed.get("assistant_message") or texts["done"])
    operations = parsed.get("operations") or []
    if not isinstance(operations, list):
        operations = []

    if scope_name == "global":
        pruned = _prune_unrequested_attributes(body.message, operations)
        if pruned != operations:
            assistant_message = f"{assistant_message}\n\n{texts['unrequested']}"
        operations = pruned

    if relationship_scope and body.selected_relationship_id:
        scoped_links = scope_relationship_operations(
            operations, body.selected_relationship_id
        )
        if scoped_links != operations:
            assistant_message = (
                f"{assistant_message}\n\n{texts['relationship_scope']}"
            )
        operations = scoped_links

    if entity_scope and body.selected_entity_id:
        own_rel_ids = {
            r.get("id")
            for r in context.get("relationships", [])
            if isinstance(r, dict) and isinstance(r.get("id"), str)
        }
        scoped = [
            op
            for op in operations
            if isinstance(op, dict)
            and _in_entity_scope(op, body.selected_entity_id, own_rel_ids)
        ]
        if len(scoped) < len(operations):
            assistant_message = f"{assistant_message}\n\n{texts['entity_scope']}"
        operations = scoped

    return ChatResponse(assistant_message=assistant_message, operations=operations)


def _static_dir() -> Path | None:
    override = os.environ.get("ONTO_STATIC_DIR", "").strip()
    if override:
        path = Path(override)
        return path if path.is_dir() else None
    bundled = Path(__file__).resolve().parent.parent / "web" / "dist"
    return bundled if bundled.is_dir() else None


def _output_dir() -> Path | None:
    override = os.environ.get("ONTO_OUTPUT_DIR", "").strip()
    if override:
        path = Path(override)
        return path if path.is_dir() else None
    default = Path(__file__).resolve().parent.parent / "output"
    return default if default.is_dir() else None


def _mount_output(app: FastAPI) -> None:
    output = _output_dir()
    if output is None:
        return
    app.mount("/output", StaticFiles(directory=output), name="onto-output")


def _mount_ui(app: FastAPI) -> None:
    static = _static_dir()
    if static is None:
        return
    assets = static / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="onto-assets")

    index = static / "index.html"
    if not index.is_file():
        return

    @app.get("/", include_in_schema=False)
    def ui_index() -> FileResponse:
        return FileResponse(index)

    @app.get("/{path:path}", include_in_schema=False)
    def ui_spa(path: str) -> FileResponse:
        if (
            path.startswith("api")
            or path.startswith("assets")
            or path.startswith("output")
        ):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = static / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


_mount_output(app)
_mount_ui(app)
