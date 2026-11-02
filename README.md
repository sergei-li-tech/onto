# onto — Domain Model Editor

Interactive domain model editor. **Work output is a single YAML file**, validated against [schema/ontology.schema.json](schema/ontology.schema.json).

Includes a local FastAPI proxy for AI assistant features (optional) and an interactive web UI.

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
2. Refine entities, fields, relationships, and rules on the diagram.
3. Add raw notes, actions, questions, or out-of-scope items in their respective sections.
4. Rename entities as needed — `id` updates automatically while preserving `template_name`.
5. Save via **Save as…** once validation passes.

## Tests

```bash
# Frontend (Vitest)
cd web && npm test

# Backend (pytest)
uv run pytest
```
