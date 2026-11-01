# Stand build from onto/ directory.
# Context is /opt/app.
FROM node:22-alpine AS web-build

WORKDIR /src
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY web ./web
COPY templates ./templates
COPY schema ./schema
RUN cd web && npm run build

FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    ONTO_STATIC_DIR=/app/onto/web/dist \
    ONTO_OUTPUT_DIR=/app/onto/output

COPY __init__.py README.md ./onto/
COPY server ./onto/server
COPY templates ./onto/templates
COPY schema ./onto/schema
RUN mkdir -p ./onto/output
COPY --from=web-build /src/web/dist ./onto/web/dist

RUN pip install --no-cache-dir \
    "fastapi>=0.115" \
    "uvicorn[standard]>=0.30" \
    "openai>=1.40" \
    "pydantic>=2.7" \
    "google-cloud-secret-manager>=2.20"

EXPOSE 8790

CMD ["python", "-m", "uvicorn", "onto.server.main:app", "--host", "0.0.0.0", "--port", "8790"]
