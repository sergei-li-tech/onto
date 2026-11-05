# onto — Domain Model Editor

Interactive domain model editor. **Work output is a single YAML file**, validated against [schema/ontology.schema.json](schema/ontology.schema.json).

Includes a local FastAPI proxy for AI assistant features (optional) and an interactive web UI.

## Model Terms

- **Entities, fields, relationships** — the structure of the domain.
- **Invariants** (`invariants:` in YAML) — claims that are always true and are re-checked after any action. They sit where the former `rules` section used to be. A broken invariant is reported as a separate "invariant violated" message and is not mixed with schema errors.
- **Actions** (`actions:`) — domain actions. Each action has an optional free-text **Rule** field: the local execution condition that must hold before the action is allowed. It is plain text, with no DSL or executable logic.

### Reading old files

Files written before the `rules` → `invariants` rename keep their list under `rules`. They open without loss: the whole list is lifted into `invariants` with the same order and text, and the next save writes the new `invariants` key. The legacy key stays accepted by the JSON schema for reference, but the editor never writes it.

## Template

Starting file: [templates/generic.yaml](templates/generic.yaml) — entity **Client** without fields; attributes can be added via the UI (**+ Field**) or AI assistant.

Templates in the repository are never overwritten. A copy is saved via **Save as…** with a `based_on` block added automatically.

## Running the Editor

Requires **Chrome** (File System Access API for opening and saving YAML files locally).

### Docker Compose

```bash
docker compose up --build
```

UI is available at `http://localhost:8780` (configured via `ONTO_PORT`).

### Locally

**Backend (API proxy):**
```bash
uv sync
uv run python -m uvicorn onto.server.main:app --host 127.0.0.1 --port 8790
```

**Frontend (UI):**
```bash
cd web
npm install
npm run dev
```

UI runs at `http://localhost:5173`.

#### Environment Variables (Optional AI Assistant)
- `LLM_API_KEY`: API key for external LLM provider.
- `LLM_MODEL`: Model name (default configured in `onto/server/config.py`).
- `LLM_API_BASE`: Optional custom API base URL.

## Workflow

1. Select a template or open an existing YAML file.
2. Refine entities, fields ("Fields" block, **+ Field** button), relationships on diagram, and invariants.
3. Raw call notes go into the **Notes** field on the left. Invariants, actions (with their local rule), questions, or out of scope items are added line by line in their respective lists. Selecting an action opens its card on the right with the **Rule** field.
4. If the stakeholder calls an entity differently (e.g. "lead" instead of "client"): type the word into "Entity name" and blur the field. `id` is derived from the new name; former name is preserved in `template_name`.
5. **Save as…** — available when there are no validation errors (error list at top).

## Tests

```bash
# Frontend (Vitest)
cd web && npm test

# Backend (pytest)
uv run pytest
```

Validates template, key ordering during serialization, `based_on`, business rename, legacy `rules` → `invariants` reading, action rule round-trip, and the separate invariant-violation report.

## Cost

Local UI, no external paid API unless assistant chat is used.
