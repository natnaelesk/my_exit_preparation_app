"""Describe uploaded study PDFs with AI, and pick the docs relevant to a study session."""

import logging
import re

from django.db.models import Q
from django.utils import timezone

from . import ai_client
from .background import run_job, stale_after
from .models import StudyDoc
from .pdf_pages import PdfReadError, render_pages
from .curriculum import active_blueprint, active_course_names, match_course

logger = logging.getLogger(__name__)

DESCRIBE_PAGES = 3
EXCERPT_CHARS = 20000
TEXT_FOR_AI_CHARS = 6000
MAX_TOPICS = 8
MAX_KEY_POINTS = 8

CONTEXT_MAX_DOCS = 3
CONTEXT_EXCERPT_CHARS = 1500
EXCERPT_WINDOW_CHARS = 500

SYSTEM_PROMPT = """You catalogue study materials for a university student preparing for the Ethiopian national exit exam ({program}).
You receive the first pages of a PDF (page images plus any text layer) and describe the document so it can be matched to study topics later.

Reply with ONLY a JSON object, no prose:
{{"title": "short document title",
  "description": "1-3 sentences: what the document covers and what it is useful for when studying",
  "subject": "the best match from the student's courses, or an empty string: {subjects}",
  "topics": ["up to {max_topics} short topic names covered, e.g. Normalization, Deadlock, TCP/IP model"],
  "keyPoints": ["up to {max_key_points} short facts or definitions the document teaches"]}}"""


def _clean_text(value, max_len):
    return ' '.join(str(value or '').split())[:max_len] if isinstance(value, (str, int, float)) else ''


def _clean_list(value, max_items, max_len):
    if not isinstance(value, list):
        return []
    items = []
    for item in value:
        text = _clean_text(item, max_len)
        if text and text not in items:
            items.append(text)
        if len(items) == max_items:
            break
    return items


def normalize_description(data, subjects):
    if not isinstance(data, dict):
        raise ai_client.BadAIOutput('expected a JSON object')
    description = _clean_text(data.get('description'), 800)
    if not description:
        raise ai_client.BadAIOutput('missing description')
    return {
        'title': _clean_text(data.get('title'), 255),
        'description': description,
        'subject': match_course(data.get('subject'), subjects),
        'topics': _clean_list(data.get('topics'), MAX_TOPICS, 80),
        'key_points': _clean_list(data.get('keyPoints'), MAX_KEY_POINTS, 300),
    }


def build_messages(doc, pages, program, subjects):
    content = [{
        'type': 'text',
        'text': (
            f'File name: {doc.original_filename}\n'
            f'Total pages: {doc.page_count}\n'
            f'Text layer sample (may be empty for scanned PDFs):\n{doc.text_excerpt[:TEXT_FOR_AI_CHARS]}'
        ),
    }]
    for page in pages:
        content.append({'type': 'text', 'text': f'Page {page["number"]}:'})
        content.append({'type': 'image_url', 'image_url': {'url': page['image_data_url']}})
    return [
        {'role': 'system', 'content': SYSTEM_PROMPT.format(
            program=program or 'program not set yet',
            subjects='; '.join(subjects) or '(no curriculum yet; use an empty string)',
            max_topics=MAX_TOPICS,
            max_key_points=MAX_KEY_POINTS,
        )},
        {'role': 'user', 'content': content},
    ]


def _fail(doc_id, message):
    StudyDoc.objects.filter(pk=doc_id, status=StudyDoc.STATUS_DESCRIBING).update(
        status=StudyDoc.STATUS_FAILED, error=message, updated_at=timezone.now(),
    )


def describe(doc_id):
    doc = StudyDoc.objects.filter(pk=doc_id, status=StudyDoc.STATUS_DESCRIBING).first()
    if doc is None:
        return
    try:
        if not ai_client.is_configured():
            raise ai_client.AIConfigError('CURSOR_API_KEY is not set')
        with doc.file.open('rb') as handle:
            data = handle.read()
        pages = render_pages(data, 0, min(DESCRIBE_PAGES, doc.page_count))
        blueprint = active_blueprint(doc.owner)
        subjects = active_course_names(doc.owner)
        messages = build_messages(doc, pages, blueprint.program_name if blueprint else '', subjects)
        for attempt in range(2):
            try:
                result = normalize_description(ai_client.parse_json_reply(ai_client.complete(messages)), subjects)
                break
            except ai_client.AITimeoutError:
                raise
            except (ai_client.BadAIOutput, ai_client.AIUnavailableError):
                if attempt == 1:
                    raise
    except ai_client.AIConfigError as exc:
        _fail(doc_id, f'AI descriptions are not configured on the server ({exc}). The file is saved; retry once AI is set up.')
    except ai_client.AITimeoutError as exc:
        _fail(doc_id, f'{exc} The file is saved; retry.')
    except ai_client.AIUnavailableError:
        _fail(doc_id, 'The AI service is busy or unreachable right now. The file is saved; retry in a minute.')
    except ai_client.BadAIOutput:
        _fail(doc_id, 'The AI reply could not be understood. The file is saved; retry.')
    except (OSError, ValueError, PdfReadError):
        _fail(doc_id, 'The stored PDF is no longer available (server storage was reset). Delete this doc and upload it again.')
    except Exception:
        logger.exception('Describing study doc %s failed', doc_id)
        _fail(doc_id, 'Something went wrong while describing this PDF. Retry.')
    else:
        StudyDoc.objects.filter(pk=doc_id, status=StudyDoc.STATUS_DESCRIBING).update(
            status=StudyDoc.STATUS_READY,
            error='',
            title=result['title'] or doc.title,
            description=result['description'],
            subject=result['subject'],
            topics=result['topics'],
            key_points=result['key_points'],
            updated_at=timezone.now(),
        )


def start_describe(doc):
    run_job(describe, doc.pk)


def claim_for_describe(doc):
    """Move a failed (or stuck) doc back to describing; False if a description is already running."""
    claimed = StudyDoc.objects.filter(
        Q(status=StudyDoc.STATUS_FAILED)
        | Q(status=StudyDoc.STATUS_READY)
        | Q(status=StudyDoc.STATUS_DESCRIBING, updated_at__lt=timezone.now() - stale_after()),
        pk=doc.pk,
    ).update(status=StudyDoc.STATUS_DESCRIBING, error='', updated_at=timezone.now())
    return claimed == 1


def mark_if_stale(doc):
    if doc.status == StudyDoc.STATUS_DESCRIBING and doc.updated_at < timezone.now() - stale_after():
        _fail(doc.pk, 'Describing was interrupted (the server restarted). Retry.')
        doc.refresh_from_db()
    return doc


# ---------------------------------------------------------------------------
# Retrieval: simple keyword overlap between session topics and doc metadata
# ---------------------------------------------------------------------------

WORD_RE = re.compile(r'[a-z0-9+#]+')
STOPWORDS = {
    'and', 'the', 'for', 'with', 'from', 'into', 'its', 'are', 'was', 'that', 'this', 'their', 'using',
    'use', 'how', 'what', 'why', 'introduction', 'intro', 'basics', 'basic', 'fundamentals', 'general',
    'overview', 'chapter', 'part', 'notes', 'pdf', 'study', 'guide', 'exam', 'exit', 'system', 'systems',
}


def terms(*texts):
    words = set()
    for text in texts:
        for word in WORD_RE.findall(str(text or '').lower()):
            if len(word) >= 2 and word not in STOPWORDS:
                words.add(word)
    return words


def score_doc(doc, subject, topic_terms):
    meta_terms = terms(doc.title, doc.original_filename, doc.description, *doc.topics, *doc.key_points)
    score = 3 * len(topic_terms & meta_terms)
    if subject and doc.subject == subject:
        score += 4
    elif subject:
        score += len(terms(subject) & meta_terms)
    if doc.text_excerpt and topic_terms:
        score += min(len(topic_terms & terms(doc.text_excerpt)), 3)
    return score


def relevant_docs(owner, subject, topics, limit=CONTEXT_MAX_DOCS):
    topic_terms = terms(*topics)
    scored = []
    for doc in StudyDoc.objects.filter(owner=owner):
        score = score_doc(doc, subject, topic_terms)
        if score > 0:
            scored.append((score, doc.created_at, doc))
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [doc for _, _, doc in scored[:limit]]


def best_excerpt(doc, topic_terms, max_chars=CONTEXT_EXCERPT_CHARS):
    """The windows of the doc's text layer that mention the most topic terms, in document order."""
    text = doc.text_excerpt
    if not text or not topic_terms:
        return ''
    windows = [text[i:i + EXCERPT_WINDOW_CHARS] for i in range(0, len(text), EXCERPT_WINDOW_CHARS)]
    ranked = sorted(
        ((len(topic_terms & terms(window)), index) for index, window in enumerate(windows)),
        reverse=True,
    )
    chosen = sorted(index for hits, index in ranked[:max_chars // EXCERPT_WINDOW_CHARS] if hits > 0)
    return ' … '.join(windows[index].strip() for index in chosen)


def context_block(docs, topics):
    if not docs:
        return 'The student has no uploaded study materials matching these topics. Teach from standard curriculum knowledge.'
    topic_terms = terms(*topics)
    parts = []
    for number, doc in enumerate(docs, start=1):
        lines = [f'[Material {number}] {doc.title or doc.original_filename}']
        if doc.description:
            lines.append(f'Description: {doc.description}')
        if doc.topics:
            lines.append(f'Topics: {", ".join(doc.topics)}')
        if doc.key_points:
            lines.append('Key points: ' + ' | '.join(doc.key_points))
        excerpt = best_excerpt(doc, topic_terms)
        if excerpt:
            lines.append(f'Excerpt: {excerpt}')
        parts.append('\n'.join(lines))
    return '\n\n'.join(parts)
