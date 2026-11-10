from onto.server.relationship_scope import (
    RELATIONSHIP_SCOPE_PROMPT,
    relationship_context,
    scope_relationship_operations,
)


def test_relationship_prompt_keeps_the_scope_on_one_link():
    assert "selected_relationship_id" in RELATIONSHIP_SCOPE_PROMPT
    assert "cardinality" in RELATIONSHIP_SCOPE_PROMPT
    assert "cannot change from and to" in RELATIONSHIP_SCOPE_PROMPT.lower()


def test_relationship_context_names_both_ends():
    context = relationship_context(
        {
            "entities": [
                {"id": "entity_consultation", "name": "Consultation"},
                {"id": "entity_order", "name": "Order"},
            ],
            "relationships": [
                {
                    "id": "rel-provides",
                    "from": "entity_consultation",
                    "to": "entity_order",
                    "name": "provides",
                    "cardinality": "0..*",
                }
            ],
        },
        "rel-provides",
    )
    assert context["relationship"]["name"] == "provides"
    assert context["from_entity"] == {
        "id": "entity_consultation",
        "name": "Consultation",
    }
    assert context["to_entity"] == {"id": "entity_order", "name": "Order"}


def test_relationship_scope_keeps_name_and_cardinality_for_this_link():
    scoped = scope_relationship_operations(
        [
            {
                "op": "update_relationship",
                "id": "rel-provides",
                "patch": {
                    "name": "provides",
                    "cardinality": "0..*",
                    "from": "other",
                    "to": "other",
                },
            }
        ],
        "rel-provides",
    )
    assert scoped == [
        {
            "op": "update_relationship",
            "id": "rel-provides",
            "patch": {
                "name": "provides",
                "cardinality": "0..*",
            },
        }
    ]


def test_relationship_scope_drops_other_work():
    scoped = scope_relationship_operations(
        [
            {"op": "update_relationship", "id": "rel-other", "patch": {"name": "no"}},
            {"op": "add_entity", "entity": {"id": "order"}},
            {"op": "update_relationship", "id": "rel-provides", "patch": {"invalid_field": "2"}},
            {"op": "update_relationship", "id": "rel-provides", "patch": {}},
            {"op": "remove_entity", "id": "entity_order"},
        ],
        "rel-provides",
    )
    assert scoped == []
