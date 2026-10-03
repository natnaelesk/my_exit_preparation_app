"""Server-side AI through the Cursor Python SDK (`cursor-sdk`), using no-repo cloud agents.

The agents run on Cursor-hosted VMs with no repository attached, so they only see what we send them.
"""

import json
import logging
import re
import threading
import time
from contextlib import contextmanager

from cursor_sdk import (
    Agent,
    AgentOptions,
    CloudAgentOptions,
    CloudEnvironment,
    Cursor,
    ModelParameterValue,
    ModelSelection,
    SDKImage,
    UserMessage,
    errors as sdk_errors,
)
from django.conf import settings

logger = logging.getLogger(__name__)

MAX_IMAGES_PER_SEND = 5
SMART_MODEL = 'auto-smart'
VISION = 'intelligence'
CHAT = 'balanced'
MODEL_CATALOG_SECONDS = 3600

SERVICE_RULES = (
    'You are running as a backend service for a study app. There is no repository and there are no files: '
    'everything you need is in this message. Do not use tools, run commands, or browse.'
)
ONE_SHOT_RULES = SERVICE_RULES + (
    ' Reply with only the requested output: no preamble, no narration of what you are doing, no closing remarks.'
)
CHAT_RULES = SERVICE_RULES + (
    ' Reply with only your next message to the student, in Markdown, with no narration of what you are doing.'
)

DATA_URL_RE = re.compile(r'^data:(image/[\w.+-]+);base64,(.+)$', re.DOTALL)


class AIConfigError(Exception):
    """The provider rejected the request in a way retrying will not fix (key, model, account settings)."""


class AIUnavailableError(Exception):
    """A transient provider failure (network, timeout, rate limit, 5xx)."""


class AITimeoutError(AIUnavailableError):
    """The cloud agent did not finish within AI_TIMEOUT_SECONDS; retrying right away is not worth it."""


class BadAIOutput(Exception):
    """The model replied, but not with the text or JSON we asked for."""


def api_key():
    """CURSOR_API_KEY, or a legacy AI_API_KEY that is a Cursor key (crsr_...)."""
    legacy = settings.AI_API_KEY
    return settings.CURSOR_API_KEY or (legacy if legacy.startswith('crsr_') else '')


def is_configured():
    return bool(api_key())


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

def _detail(exc):
    return str(getattr(exc, 'message', '') or exc)[:300]


@contextmanager
def _translated_errors():
    try:
        yield
    except (sdk_errors.AuthenticationError, sdk_errors.PermissionDeniedError) as exc:
        raise AIConfigError('Cursor rejected the server API key (check CURSOR_API_KEY).') from exc
    except sdk_errors.RateLimitError as exc:
        raise AIUnavailableError('Cursor rate or usage limit reached. Retry in a few minutes.') from exc
    except (sdk_errors.NetworkError, sdk_errors.InternalServerError, sdk_errors.AgentBusyError) as exc:
        raise AIUnavailableError('Could not reach Cursor right now.') from exc
    except (sdk_errors.ConfigurationError, sdk_errors.BadRequestError) as exc:
        raise AIConfigError(
            'Cursor rejected the request (check CURSOR_MODEL and that no-repo cloud agents are enabled): '
            + _detail(exc)
        ) from exc
    except sdk_errors.CursorAgentError as exc:
        raise AIUnavailableError(f'Cursor request failed: {_detail(exc)}') from exc


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

_catalog = {}
_catalog_lock = threading.Lock()


def _model_catalog():
    """The account's model list, cached per process. Empty when it cannot be fetched."""
    with _catalog_lock:
        if _catalog and time.monotonic() - _catalog['at'] < MODEL_CATALOG_SECONDS:
            return _catalog['models']
        try:
            models = Cursor.models.list(api_key=api_key())
        except (sdk_errors.AuthenticationError, sdk_errors.PermissionDeniedError):
            raise
        except sdk_errors.CursorAgentError as exc:
            logger.warning('Could not list Cursor models (%s); using the default model', _detail(exc))
            return []
        _catalog.update(models=list(models), at=time.monotonic())
        return _catalog['models']


def _normalized(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())


def resolve_model(optimize_for):
    """CURSOR_MODEL if set; else auto-smart tuned for `optimize_for`; else what the catalog offers."""
    if settings.CURSOR_MODEL:
        return ModelSelection(id=settings.CURSOR_MODEL)
    models = _model_catalog()
    smart = next((model for model in models if model.id == SMART_MODEL), None)
    if models and smart is None:
        fallback = next((model for model in models if model.id == 'auto'), models[0])
        return ModelSelection(id=fallback.id)
    if smart is None:
        return ModelSelection(id=SMART_MODEL, params=(ModelParameterValue(id='optimize_for', value=optimize_for),))

    param = next((p for p in smart.parameters if _normalized(p.id) == 'optimizefor'), None)
    if param is None:
        return ModelSelection(id=SMART_MODEL)
    allowed = {value.value for value in param.values}
    value = next((v for v in (optimize_for, VISION) if not allowed or v in allowed), None)
    params = (ModelParameterValue(id=param.id, value=value),) if value else ()
    return ModelSelection(id=SMART_MODEL, params=params)


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

def _parts(content):
    return [{'type': 'text', 'text': content}] if isinstance(content, str) else list(content)


def _image(url):
    match = DATA_URL_RE.match(url or '')
    if not match:
        raise ValueError('Only base64 data-URL images can be sent to the AI.')
    return SDKImage(data=match.group(2), mime_type=match.group(1))


def build_user_message(messages, rules=ONE_SHOT_RULES):
    """Flatten chat-style messages (text and data-URL image parts) into one SDK user message."""
    headings = {'system': 'Instructions', 'user': 'Input'}
    sections, images = [rules], []
    for message in messages:
        lines = []
        for part in _parts(message['content']):
            if part.get('type') == 'image_url':
                images.append(_image(part['image_url']['url']))
                lines.append(f'[Image {len(images)} attached]')
            elif part.get('text'):
                lines.append(part['text'])
        sections.append(f"## {headings.get(message['role'], message['role'].title())}\n" + '\n'.join(lines))
    if len(images) > MAX_IMAGES_PER_SEND:
        raise ValueError(f'At most {MAX_IMAGES_PER_SEND} images can be sent at once (got {len(images)}).')
    return UserMessage(text='\n\n'.join(sections), images=images or None)


def build_chat_opening(messages):
    """The first message to a new tutor agent: rules, system prompt, any earlier turns, and the latest message."""
    system = '\n\n'.join(m['content'] for m in messages if m['role'] == 'system')
    turns = [m for m in messages if m['role'] != 'system']
    sections = [CHAT_RULES, f'## Instructions\n{system}']
    if len(turns) > 1:
        names = {'user': 'Student', 'assistant': 'Tutor'}
        transcript = '\n\n'.join(f"{names.get(m['role'], m['role'])}: {m['content']}" for m in turns[:-1])
        sections.append(f'## Conversation so far\n{transcript}')
    sections.append(f"## Student's message\n{turns[-1]['content']}")
    return '\n\n'.join(sections)


# ---------------------------------------------------------------------------
# Agents and runs
# ---------------------------------------------------------------------------

def _create_agent(optimize_for, name):
    agent = Agent.create(
        model=resolve_model(optimize_for),
        api_key=api_key(),
        name=name,
        # repos=[] alone serializes to an empty cloud block, which the SDK treats as a *local* agent
        # running on this server; the explicit env keeps it a no-repo cloud agent.
        cloud=CloudAgentOptions(repos=[], env=CloudEnvironment(type='cloud')),
    )
    if not agent.agent_id.startswith('bc-'):
        _dispose(agent, delete=True)
        raise AIConfigError('Cursor did not start a cloud agent.')
    return agent


def _dispose(agent, delete):
    """Best-effort cleanup; never let it mask the real result."""
    if delete:
        try:
            agent.delete()
        except Exception:
            try:
                agent.archive()
            except Exception as exc:
                logger.warning('Could not delete Cursor agent %s: %s', agent.agent_id, exc)
    try:
        agent.close()
    except Exception:
        pass


def _send(agent, message):
    """Send one message and wait for the reply text, cancelling the run after AI_TIMEOUT_SECONDS."""
    timeout = settings.AI_TIMEOUT_SECONDS
    run = agent.send(message)
    logger.info('Cursor run %s started on agent %s', run.id, agent.agent_id)
    timed_out = threading.Event()

    def cancel():
        timed_out.set()
        try:
            run.cancel()
        except Exception as exc:
            logger.warning('Could not cancel Cursor run %s: %s', run.id, exc)

    timer = threading.Timer(timeout, cancel)
    timer.daemon = True
    timer.start()
    try:
        result = run.wait()
    finally:
        timer.cancel()

    if timed_out.is_set():
        raise AITimeoutError(f'The AI did not answer within {max(1, timeout // 60)} minute(s).')
    if result.status != 'finished':
        raise AIUnavailableError(f'The AI run ended with status "{result.status}".')
    text = (result.result or '').strip()
    if not text:
        raise BadAIOutput('empty reply')
    return text


def complete(messages, optimize_for=VISION):
    """One-shot job (exam page batch, study-doc describe): create agent, send, wait, delete. Returns the reply text."""
    message = build_user_message(messages)
    with _translated_errors():
        agent = _create_agent(optimize_for, 'exit-prep job')
        try:
            return _send(agent, message)
        finally:
            _dispose(agent, delete=True)


def chat_turn(agent_id, messages):
    """Answer the last user message on a persistent tutor agent. Returns (agent_id, reply).

    Resumes `agent_id` and sends only the latest message; with no agent yet (or when Cursor no longer has it),
    starts a new agent and sends the system prompt plus the transcript so far.
    """
    with _translated_errors():
        if agent_id:
            try:
                agent = Agent.resume(agent_id, AgentOptions(api_key=api_key()))
            except sdk_errors.NotFoundError:
                logger.info('Cursor agent %s is gone; starting a new tutor agent', agent_id)
            else:
                try:
                    return agent_id, _send(agent, messages[-1]['content'])
                except sdk_errors.NotFoundError:
                    logger.info('Cursor agent %s is gone; starting a new tutor agent', agent_id)
                finally:
                    _dispose(agent, delete=False)

        agent = _create_agent(CHAT, 'exit-prep study chat')
        try:
            reply = _send(agent, build_chat_opening(messages))
        except BaseException:
            _dispose(agent, delete=True)
            raise
        _dispose(agent, delete=False)
        return agent.agent_id, reply


def delete_agent(agent_id):
    """Best-effort delete of a persistent agent (e.g. when its study session is deleted)."""
    if not agent_id or not is_configured():
        return
    try:
        Agent.delete(agent_id, {'apiKey': api_key()})
    except Exception as exc:
        logger.warning('Could not delete Cursor agent %s: %s', agent_id, exc)


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
