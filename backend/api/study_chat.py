"""Study chat: the deep-study tutor protocol, session context, and background AI replies."""

import logging
from collections import Counter

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from . import ai_client
from .background import run_job, stale_after
from .curriculum import active_blueprint, course_for_subject
from .models import DailyPlan, Question, StudyMessage, StudySession
from .study_docs import context_block, relevant_docs

logger = logging.getLogger(__name__)

MAX_SESSION_TOPICS = 8
MAX_HISTORY_CHARS = 24000
MAX_MESSAGE_CHARS = 4000

SYSTEM_PROMPT = """You are a focused tutor for a student in Ethiopia preparing for the national exit exam.

Session scope
- Program: {program}
- Subject: {subject}
- Topics: {topics}

What the official exit exam blueprint expects for this subject (cover these points; they are what gets examined)
{focus_notes}

Deep-study protocol (follow it strictly)
1. Teach the session topics in EXACTLY 4 conceptual chunks in total, from foundations to exam-level detail. Start each chunk with a heading "## Chunk N of 4: <name>".
2. Send ONLY ONE chunk per reply. Every chunk ends with these three sections, in this order:
   ### Memory Lock
   A mnemonic or 3-5 bullet summary worth memorising.
   ### Exam Traps
   The common mistakes and trick options examiners use on this chunk.
   ### Likely Questions
   2-3 exam-style questions (multiple choice where natural), with the answers on one final "Answers:" line.
3. After each chunk, stop and ask the student to reply "continue" for the next chunk. Never send the next chunk until they say "continue" (or an equivalent such as "next", "go on", "ok").
4. If the student asks a question instead, answer it briefly within scope, then remind them to say "continue".
5. After Chunk 4, give a short wrap-up and offer a quick mixed quiz over all four chunks.
6. Stay within the session topics and the student's study materials below. If asked about unrelated subjects, decline briefly and steer back. Do not invent unrelated subjects.
7. Prefer the student's own materials when they cover a point, and say "(from your materials: <title>)" when you rely on them. Never invent content that the materials do not contain.

The student's study materials, retrieved by topic overlap
{materials}"""


class SessionContextError(Exception):
    """A user-facing problem with the requested study context."""


def plan_context(owner, date_key):
    plan = DailyPlan.objects.filter(owner=owner, date_key=date_key).first()
    if plan is None:
        raise SessionContextError('No study plan exists for that day yet. Open the planner first.')
    counts = Counter(
        topic.strip()
        for topic in Question.objects.filter(owner=owner, question_id__in=plan.question_ids)
        .values_list('topic', flat=True)
        if topic and topic.strip() and topic.strip().lower() != 'general'
    )
    topics = [topic for topic, _ in counts.most_common(MAX_SESSION_TOPICS)] or [plan.focus_subject]
    return {
        'context_key': f'plan:{date_key}',
        'title': f'{plan.focus_subject} — plan for {date_key}',
        'subject': plan.focus_subject,
        'topics': topics,
        'plan_date_key': date_key,
    }


def topic_context(subject, topic):
    subject = ' '.join(str(subject or '').split())[:200]
    topic = ' '.join(str(topic or '').split())[:200]
    if not subject and not topic:
        raise SessionContextError('Pick a plan day, or a subject/topic to study.')
    return {
        'context_key': f'topic:{subject.lower()}|{topic.lower()}',
        'title': f'{topic} — {subject}' if topic and subject else (topic or subject),
        'subject': subject,
        'topics': [topic] if topic else [subject],
        'plan_date_key': '',
    }


def get_or_create_session(owner, context):
    session, created = StudySession.objects.get_or_create(
        owner=owner,
        context_key=context['context_key'],
        defaults={key: value for key, value in context.items() if key != 'context_key'},
    )
    if not created and session.topics != context['topics']:
        # The plan's questions can change during the day; keep the tutor's scope in sync.
        session.topics = context['topics']
        session.save(update_fields=['topics', 'updated_at'])
    return session, created


def build_messages(session, docs):
    blueprint = active_blueprint(session.owner)
    course = course_for_subject(session.owner, session.subject)
    system = SYSTEM_PROMPT.format(
        program=blueprint.program_name if blueprint else 'not set',
        focus_notes=(course.focus_notes.strip() if course else '') or '(no blueprint notes for this subject)',
        subject=session.subject or 'General',
        topics=', '.join(session.topics) or session.subject,
        materials=context_block(docs, session.topics),
    )
    history, used = [], 0
    for message in session.messages.order_by('-created_at', '-id'):
        used += len(message.content)
        if history and used > MAX_HISTORY_CHARS:
            break
        history.append({'role': message.role, 'content': message.content})
    history.reverse()
    return [{'role': 'system', 'content': system}, *history]


def _fail(session_id, message):
    StudySession.objects.filter(pk=session_id, status=StudySession.STATUS_THINKING).update(
        status=StudySession.STATUS_FAILED, error=message, updated_at=timezone.now(),
    )


def generate_reply(session_id):
    session = StudySession.objects.filter(pk=session_id, status=StudySession.STATUS_THINKING).first()
    if session is None:
        return
    try:
        if not ai_client.is_configured():
            raise ai_client.AIConfigError('CURSOR_API_KEY is not set')
        messages = build_messages(session, relevant_docs(session.owner, session.subject, session.topics))
        for attempt in range(2):
            try:
                agent_id, text = ai_client.chat_turn(session.cursor_agent_id, messages)
                break
            except ai_client.AITimeoutError:
                raise
            except (ai_client.BadAIOutput, ai_client.AIUnavailableError):
                if attempt == 1:
                    raise
    except ai_client.AIConfigError as exc:
        _fail(session_id, f'The AI tutor is not configured on the server ({exc}).')
    except ai_client.AITimeoutError as exc:
        _fail(session_id, f'{exc} Retry.')
    except ai_client.AIUnavailableError:
        _fail(session_id, 'The AI service is busy or unreachable right now. Retry in a minute.')
    except ai_client.BadAIOutput:
        _fail(session_id, 'The AI returned an empty reply. Retry.')
    except Exception:
        logger.exception('Study reply for session %s failed', session_id)
        _fail(session_id, 'Something went wrong while generating the reply. Retry.')
    else:
        with transaction.atomic():
            finished = StudySession.objects.filter(pk=session_id, status=StudySession.STATUS_THINKING).update(
                status=StudySession.STATUS_IDLE, error='', cursor_agent_id=agent_id, updated_at=timezone.now(),
            )
            if finished:
                StudyMessage.objects.create(session_id=session_id, role=StudyMessage.ROLE_ASSISTANT, content=text)
        if not finished and agent_id != session.cursor_agent_id:
            ai_client.delete_agent(agent_id)


def claim_for_reply(session):
    """Mark the session as thinking; False if a reply is already being generated."""
    claimed = StudySession.objects.filter(
        Q(status__in=[StudySession.STATUS_IDLE, StudySession.STATUS_FAILED])
        | Q(status=StudySession.STATUS_THINKING, updated_at__lt=timezone.now() - stale_after()),
        pk=session.pk,
    ).update(status=StudySession.STATUS_THINKING, error='', updated_at=timezone.now())
    return claimed == 1


def start_reply(session):
    run_job(generate_reply, session.pk)


def mark_if_stale(session):
    if session.status == StudySession.STATUS_THINKING and session.updated_at < timezone.now() - stale_after():
        _fail(session.pk, 'The reply was interrupted (the server restarted). Retry.')
        session.refresh_from_db()
    return session
