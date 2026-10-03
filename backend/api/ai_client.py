"""Minimal OpenAI-compatible chat-completions client (server-side only)."""

import json
import re

import requests
from django.conf import settings


class AIConfigError(Exception):
    """The provider rejected the request in a way retrying will not fix (key, model, unsupported input)."""


class AIUnavailableError(Exception):
    """A transient provider failure (network, timeout, rate limit, 5xx)."""


class BadAIOutput(Exception):
    """The model replied, but not with the JSON we asked for."""


def is_configured():
    return bool(settings.AI_API_KEY and settings.AI_MODEL)


def _provider_message(response):
    try:
        error = response.json().get('error')
    except ValueError:
        return ''
    message = error.get('message', '') if isinstance(error, dict) else str(error or '')
    return message[:300]


def chat_completion(messages):
    """Send messages and return (assistant_text, finish_reason)."""
    payload = {'model': settings.AI_MODEL, 'messages': messages}
    if settings.AI_MAX_TOKENS:
        payload['max_tokens'] = settings.AI_MAX_TOKENS

    try:
        response = requests.post(
            f'{settings.AI_BASE_URL}/chat/completions',
            json=payload,
            headers={'Authorization': f'Bearer {settings.AI_API_KEY}'},
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
    except requests.Timeout as exc:
        raise AIUnavailableError('The AI provider took too long to respond.') from exc
    except requests.RequestException as exc:
        raise AIUnavailableError('Could not reach the AI provider.') from exc

    if response.status_code in (401, 403):
        raise AIConfigError('The AI provider rejected the server API key (check AI_API_KEY).')
    if response.status_code in (400, 404, 422):
        detail = _provider_message(response)
        raise AIConfigError(
            'The AI provider rejected the request (check AI_MODEL supports image input)'
            + (f': {detail}' if detail else '.')
        )
    if response.status_code == 429 or response.status_code >= 500:
        raise AIUnavailableError(f'The AI provider is busy or unavailable (HTTP {response.status_code}).')
    if not response.ok:
        raise AIUnavailableError(f'Unexpected AI provider response (HTTP {response.status_code}).')

    try:
        choice = response.json()['choices'][0]
        content = choice['message'].get('content') or ''
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        return '', None
    if isinstance(content, list):
        content = ''.join(part.get('text', '') for part in content if isinstance(part, dict))
    return content, choice.get('finish_reason')


def parse_json_reply(text):
    """Parse a model reply that should be JSON, tolerating markdown fences and surrounding prose."""
    cleaned = re.sub(r'^\s*```(?:json)?\s*|\s*```\s*$', '', text or '', flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except ValueError:
        start, end = cleaned.find('{'), cleaned.rfind('}')
        if start == -1 or end <= start:
            raise BadAIOutput('no JSON object found')
        try:
            return json.loads(cleaned[start:end + 1])
        except ValueError as exc:
            raise BadAIOutput('invalid JSON') from exc
