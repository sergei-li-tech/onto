"""Draft assistant: propose entities and fields without writing the schema."""

from __future__ import annotations

from typing import Any

DRAFT_HISTORY_LIMIT = 6

DRAFT_SYSTEM_PROMPT = """You are a draft assistant. You do not modify the schema directly.

Based on raw notes, propose entities and their fields. Do not re-propose entities that already exist in ontology.
These are questions and phrasing for another assistant that writes the schema. You do not record anything yourself.

If history is not empty, these are previous turns in the same conversation. Do not repeat questions already asked. Take user answers into account.
brief is the full phrasing for writing the schema across the whole conversation, not just the last reply.

Respond ONLY with JSON:
{
  "assistant_message": "2–4 short clarifying questions. No editor instructions.",
  "brief": "text for writing the schema. Each new entity is a separate sentence: 'Add entity Name. Fields: field, field.' If it is too early to record, brief is an empty string.",
  "operations": []
}

operations is always []. Do not invent ids, types, or YAML.
Do not put uncertain fields in brief — ask about them in assistant_message.
Do not repeat brief inside assistant_message."""


def draft_history(turns: list[Any]) -> list[dict[str, str]]:
    kept: list[dict[str, str]] = []
    for item in turns:
        if not isinstance(item, dict):
            continue
        user = item.get("user")
        assistant = item.get("assistant")
        if not isinstance(user, str) or not isinstance(assistant, str):
            continue
        user_text = user.strip()
        assistant_text = assistant.strip()
        if not user_text or not assistant_text:
            continue
        brief_raw = item.get("brief")
        brief = brief_raw.strip() if isinstance(brief_raw, str) else ""
        kept.append({"user": user_text, "assistant": assistant_text, "brief": brief})
    return kept[-DRAFT_HISTORY_LIMIT:]


def normalize_draft_reply(
    parsed: dict[str, Any], fallback_message: str = "More details needed."
) -> dict[str, Any]:
    message = parsed.get("assistant_message")
    text = message.strip() if isinstance(message, str) else ""
    if not text:
        text = fallback_message
    brief_raw = parsed.get("brief")
    brief = brief_raw.strip() if isinstance(brief_raw, str) else ""
    return {"assistant_message": text, "brief": brief, "operations": []}
