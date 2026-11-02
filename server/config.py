"""onto AI server configuration."""

import os

DEFAULT_SECRET_PROJECT = os.environ.get("GCP_PROJECT", "")
LLM_API_KEY_SECRET = os.environ.get("LLM_API_KEY_SECRET", "llm-api-key")
LLM_API_KEY_ENV = "LLM_API_KEY"
LLM_API_BASE = os.environ.get("LLM_API_BASE", "")
LLM_CHAT_MODEL = os.environ.get("LLM_MODEL", "llm-chat")
