"""Resolve chat API key (env or GCP Secret Manager)."""

from __future__ import annotations

import os

from google.cloud import secretmanager

from onto.server.config import (
    DEFAULT_SECRET_PROJECT,
    LLM_API_KEY_ENV,
    LLM_API_KEY_SECRET,
)


def resolve_llm_api_key() -> str:
    env_value = os.environ.get(LLM_API_KEY_ENV)
    if env_value and env_value.strip():
        return env_value.strip()

    if not DEFAULT_SECRET_PROJECT:
        raise ValueError(
            f"'{LLM_API_KEY_ENV}' environment variable is not set and no GCP_PROJECT configured for Secret Manager."
        )

    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{DEFAULT_SECRET_PROJECT}/secrets/{LLM_API_KEY_SECRET}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8").strip()
