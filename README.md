# onto — Domain Model Editor for Calls

PoC: English domain model editor for screen-sharing with a business stakeholder. **Work output is a single YAML file**, validated against [schema/ontology.schema.json](schema/ontology.schema.json).

Non-production: local FastAPI proxy for chat assistant; no database.

## Model Terms

- **Entities, fields, relationships** — the structure of the domain.
- **Invariants** (`invariants:` in YAML) — claims that are always true and are re-checked after any action. They sit where the former `rules` section used to be. A broken invariant is reported as a separate "invariant violated" message and is not mixed with schema errors.
- **Actions** (`actions:`) — domain actions. Each action has an optional free-text **Rule** field: the local execution condition that must hold before the action is allowed. It is plain text, with no DSL or executable logic.

### Reading old files

Files written before the `rules` → `invariants` rename keep their list under `rules`. They open without loss: the whole list is lifted into `invariants` with the same order and text, and the next save writes the new `invariants` key. The legacy key stays accepted by the JSON schema for reference, but the editor never writes it.

## Template

Single starting file: [templates/generic.yaml](templates/generic.yaml) — one entity **Client** without fields; attributes are added during the call (**+ Field** or assistant).

Templates in the repository are **never overwritten** from the editor. A copy is saved via "Save as…"; a `based_on` block is added to the file.

## Running the Editor

Requires **Chrome** (File System Access API for opening/saving YAML on disk).

### Docker Compose

```bash
# from onto directory:
docker compose up --build
# or from repo root:
docker compose -f onto/docker-compose.yml up --build
```

UI: `http://localhost:8780` (port is configured by `ONTO_PORT`; 8080 is often taken by other services). Single container: uvicorn serves UI and `/api`. The `output/` directory is mounted to `/app/onto/output`; files are available at `/output/…`.

### Locally (two processes)

Chat assistant uses a paid external API, the key is not exposed to the browser:

```bash
# from onto directory — API proxy
uv sync
uv run python -m uvicorn onto.server.main:app --host 127.0.0.1 --port 8790

# UI
cd web
npm install
npm run dev
```

Key: `LLM_API_KEY` environment variable or Secret Manager (via `GCP_PROJECT` and `LLM_API_KEY_SECRET`). Model: `LLM_MODEL` (if not set — default value in `onto/server/config.py`). Base URL: `LLM_API_BASE` (optional).

Open the Vite URL (typically `http://localhost:5173`). **Draft** suggests entities and fields from raw notes as text without changing the schema; the "Send to schema assistant" button passes this phrasing to the schema assistant field. **Schema assistant** sees the entire model. **Entity assistant** in the selected entity card edits only that entity. **Relationship assistant** in the selected relationship card edits only its wording and cardinality. Requests are sent to the external API after billing confirmation; changes only enter the model after clicking **Apply**.

## Call Scenario

1. Select a template or open an existing YAML file.
2. Refine entities, fields ("Fields" block, **+ Field** button), relationships on diagram, and invariants.
3. Raw call notes go into the **Notes** field on the left. Invariants, actions (with their local rule), questions, or out of scope items are added line by line in their respective lists. Selecting an action opens its card on the right with the **Rule** field.
4. If the stakeholder calls an entity differently (e.g. "lead" instead of "client"): type the word into "Entity name" and blur the field. `id` is derived from the new name; former name is preserved in `template_name`.
5. **Save as…** — available when there are no validation errors (error list at top).

## Tests

```bash
# Frontend (Vitest)
cd onto/web && npm test

# Backend (pytest)
uv run pytest
```

Validates template, key ordering during serialization, `based_on`, business rename, legacy `rules` → `invariants` reading, action rule round-trip, and the separate invariant-violation report.

## Cost

Local UI, no external paid API unless assistant chat is used.
