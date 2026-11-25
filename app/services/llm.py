"""Small text/JSON completion helper for the command bar.

Uses Claude through the official SDK when ANTHROPIC_API_KEY is set, otherwise Groq's
OpenAI-compatible API with GROQ_API_KEY. Returns (result, reader) where reader names
the provider and model, for the action log.
"""
import json
import logging

import anthropic
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5"
GROQ_DEFAULT_MODEL = "qwen/qwen3.8-27b"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def provider() -> str | None:
    p = settings.ASSISTANT_PROVIDER.strip().lower()
    if p:
        return p
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.GROQ_API_KEY:
        return "groq"
    return None


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        a, b = text.find("{"), text.rfind("}")
        if a != -1 and b > a:
            return json.loads(text[a:b + 1])
        raise


async def _anthropic(system: str, user: str, schema: dict | None):
    model = settings.ASSISTANT_MODEL or ANTHROPIC_DEFAULT_MODEL
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY or None, timeout=60.0, max_retries=1)
    output_config = {"effort": settings.ASSISTANT_EFFORT or "low"}
    if schema:
        output_config["format"] = {"type": "json_schema", "schema": schema}
    try:
        response = await client.beta.messages.create(
            model=model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=system,
            output_config=output_config,
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.AuthenticationError:
        raise LLMError("The Anthropic API key on the server is invalid.", 503)
    except anthropic.RateLimitError:
        raise LLMError("The assistant is busy right now. Try again in a minute.", 429)
    except anthropic.APIStatusError as e:
        logger.error("Anthropic error %s: %s", e.status_code, e.message)
        raise LLMError("The assistant had a problem. Try again.", 502)
    except anthropic.APIConnectionError:
        raise LLMError("Couldn't reach the assistant. Check the server's internet connection.", 502)
    if response.stop_reason == "refusal":
        raise LLMError("The assistant declined that request.", 422)
    text = next((b.text for b in response.content if b.type == "text"), "")
    return text, f"anthropic:{response.model}"


async def _groq(system: str, user: str, json_mode: bool):
    model = settings.ASSISTANT_MODEL or GROQ_DEFAULT_MODEL
    body = {"model": model, "temperature": 0,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(GROQ_URL, headers={"Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}"}, json=body)
    except httpx.HTTPError:
        raise LLMError("Couldn't reach the assistant. Check the server's internet connection.", 502)
    if r.status_code == 401:
        raise LLMError("The Groq API key on the server is invalid.", 503)
    if r.status_code == 429:
        raise LLMError("The assistant is busy right now. Try again in a minute.", 429)
    if r.status_code >= 400:
        logger.error("Groq error %s: %s", r.status_code, r.text[:500])
        raise LLMError("The assistant had a problem. Try again.", 502)
    try:
        return r.json()["choices"][0]["message"]["content"], f"groq:{model}"
    except (KeyError, IndexError, ValueError):
        raise LLMError("The assistant returned something unexpected. Try again.", 502)


async def complete_json(system: str, user: str, schema: dict) -> tuple[dict, str]:
    p = provider()
    if p == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise LLMError("ASSISTANT_PROVIDER is anthropic but ANTHROPIC_API_KEY is not set.", 503)
        text, reader = await _anthropic(system, user, schema)
    elif p == "groq":
        if not settings.GROQ_API_KEY:
            raise LLMError("ASSISTANT_PROVIDER is groq but GROQ_API_KEY is not set.", 503)
        text, reader = await _groq(system + "\n\nReply with only a JSON object.", user, json_mode=True)
    else:
        raise LLMError("The assistant needs an AI key on the server (ANTHROPIC_API_KEY or GROQ_API_KEY).", 503)
    try:
        return _parse_json(text), reader
    except json.JSONDecodeError:
        raise LLMError("The assistant returned something unexpected. Try again.", 502)
