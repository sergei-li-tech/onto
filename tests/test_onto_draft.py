from onto.server.draft import DRAFT_SYSTEM_PROMPT, draft_history, normalize_draft_reply


def test_draft_discards_operations_and_keeps_brief():
    result = normalize_draft_reply(
        {
            "assistant_message": "Clarify duration.",
            "brief": "  Add entity Appointment. Fields: service, specialist, start.  ",
            "operations": [{"op": "add_entity", "entity": {"id": "visit"}}],
        }
    )
    assert result["operations"] == []
    assert result["brief"] == "Add entity Appointment. Fields: service, specialist, start."
    assert result["assistant_message"] == "Clarify duration."


def test_draft_blank_brief_when_model_omits_it():
    result = normalize_draft_reply(
        {"assistant_message": "What is this about?", "operations": []}
    )
    assert result["brief"] == ""
    assert result["operations"] == []


def test_draft_ignores_non_string_brief():
    result = normalize_draft_reply(
        {"assistant_message": "Question", "brief": {"entity": "Appointment"}}
    )
    assert result["brief"] == ""
    assert result["operations"] == []


def test_draft_message_fallback():
    result = normalize_draft_reply({})
    assert result["assistant_message"] == "More details needed."
    assert result["brief"] == ""
    assert result["operations"] == []


def test_draft_history_keeps_complete_turns():
    history = draft_history(
        [
            {
                "user": "  appointment with specialist  ",
                "assistant": " How long does it take? ",
                "brief": " Add entity Appointment. ",
            },
            {"user": "1 hour", "assistant": "Which service?", "brief": ""},
            "note",
            {"user": "", "assistant": "Question"},
            {"user": "more", "assistant": "  ", "brief": "text"},
            {"assistant": "no user", "user": 1},
        ]
    )
    assert history == [
        {
            "user": "appointment with specialist",
            "assistant": "How long does it take?",
            "brief": "Add entity Appointment.",
        },
        {"user": "1 hour", "assistant": "Which service?", "brief": ""},
    ]


def test_draft_history_keeps_the_latest_six_turns():
    history = draft_history(
        [
            {"user": f"note {i}", "assistant": f"question {i}", "brief": f"brief {i}"}
            for i in range(8)
        ]
    )
    assert [turn["user"] for turn in history] == [f"note {i}" for i in range(2, 8)]


def test_draft_prompt_treats_history_as_the_same_conversation():
    assert "history" in DRAFT_SYSTEM_PROMPT
    assert "whole conversation" in DRAFT_SYSTEM_PROMPT
